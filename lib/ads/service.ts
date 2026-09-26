import { randomUUID } from "node:crypto";
import { AdsApiError, amazonApply, amazonListCampaigns } from "./amazon";
import { adsMode } from "./mode";
import { parseAction, type DenyHit } from "./policy";
import { planMessage, type Plan } from "./planner";
import { clone, withStore } from "./store";
import { toCsv } from "./csv";
import type {
  Actor,
  AdsAction,
  ApplyResult,
  AuditEvent,
  Campaign,
  Keyword,
  Proposal,
} from "./types";

const PROPOSAL_TTL_MS = 30 * 60 * 1000;

export async function listCampaigns(): Promise<Campaign[]> {
  if (adsMode() === "live") return amazonListCampaigns();
  return withStore((bucket) => clone(bucket.campaigns));
}

export async function workspace(actor: Actor) {
  const mode = adsMode();
  const campaigns = await listCampaigns();
  const side = await withStore((bucket) => ({
    proposals: bucket.proposals.filter((item) => item.actorId === actor.id).slice(-20),
    audit: bucket.audit.slice(-40).reverse(),
  }));
  return {
    mode,
    actorLabel: actor.label,
    spendOwner: "Shakeel Amir",
    account: "Sensationally OT",
    simulated: mode === "dry-run",
    connectHint:
      mode === "dry-run"
        ? "Amazon Ads credentials are not set. Changes stay in the simulator. See Connect Ads API."
        : "Connected to the Amazon Advertising API. Writes still wait for confirmation.",
    campaigns,
    proposals: side.proposals,
    audit: side.audit,
  };
}

export type ProposeResult =
  | { ok: true; proposal: Proposal }
  | { ok: false; status: number; error: string; deny?: DenyHit };

export async function proposeAction(actor: Actor, input: unknown, rawText?: string): Promise<ProposeResult> {
  const parsed = parseAction(input, rawText);
  if (!parsed.ok) {
    if (parsed.deny) await recordDenied(actor, parsed.deny, input);
    return { ok: false, status: parsed.status, error: parsed.error, deny: parsed.deny };
  }
  const campaigns = await listCampaigns().catch(() => [] as Campaign[]);
  const summary = describeAction(parsed.action, campaigns);
  const proposal = await withStore((bucket) => {
    const pending = bucket.proposals.filter(
      (item) => item.actorId === actor.id && item.status === "pending",
    );
    if (pending.length >= 10) {
      return { error: "Confirm or cancel the pending changes before adding more." } as const;
    }
    const now = Date.now();
    const created: Proposal = {
      id: `prop-${randomUUID()}`,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + PROPOSAL_TTL_MS).toISOString(),
      actorId: actor.id,
      actorLabel: actor.label,
      status: "pending",
      summary,
      action: parsed.action,
    };
    bucket.proposals.push(created);
    return { proposal: clone(created) };
  });
  if ("error" in proposal) {
    return { ok: false, status: 429, error: proposal.error ?? "Too many pending changes." };
  }
  return { ok: true, proposal: proposal.proposal };
}

export async function confirmProposal(actor: Actor, id: string) {
  const pending = await withStore((bucket) =>
    clone(bucket.proposals.find((item) => item.id === id) ?? null),
  );
  if (!pending) return { ok: false as const, status: 404, error: "That change was not found." };
  if (pending.actorId !== actor.id) {
    return { ok: false as const, status: 403, error: "Only the person who proposed this change can confirm it." };
  }
  if (pending.status !== "pending") {
    return { ok: false as const, status: 409, error: `This change is already ${pending.status}.` };
  }
  if (Date.parse(pending.expiresAt) < Date.now()) {
    return { ok: false as const, status: 409, error: "This confirmation expired. Propose it again." };
  }
  const recheck = parseAction(pending.action);
  if (!recheck.ok) {
    if (recheck.deny) await recordDenied(actor, recheck.deny, pending.action);
    return recheck;
  }

  try {
    const result = await applyAction(recheck.action);
    const saved = await withStore((bucket) => {
      const row = bucket.proposals.find((item) => item.id === id);
      if (!row || row.status !== "pending") return null;
      row.status = "applied";
      row.result = result;
      bucket.audit.push(auditFrom(actor, "applied", recheck.action.type, result.summary, result));
      return clone(row);
    });
    if (!saved) return { ok: false as const, status: 409, error: "This change was already resolved." };
    return { ok: true as const, proposal: saved };
  } catch (error) {
    const message = error instanceof AdsApiError ? error.message : "The change failed before it was applied.";
    await withStore((bucket) => {
      const row = bucket.proposals.find((item) => item.id === id);
      if (row && row.status === "pending") {
        row.status = "failed";
        row.error = message;
      }
      bucket.audit.push(auditFrom(actor, "failed", recheck.action.type, message, { id }));
    });
    return { ok: false as const, status: 502, error: message };
  }
}

export async function rejectProposal(actor: Actor, id: string) {
  return withStore((bucket) => {
    const row = bucket.proposals.find((item) => item.id === id);
    if (!row) return { ok: false as const, status: 404, error: "That change was not found." };
    if (row.actorId !== actor.id) {
      return { ok: false as const, status: 403, error: "Only the person who proposed this change can cancel it." };
    }
    if (row.status !== "pending") {
      return { ok: false as const, status: 409, error: `This change is already ${row.status}.` };
    }
    row.status = "rejected";
    bucket.audit.push(auditFrom(actor, "rejected", row.action.type, `Cancelled: ${row.summary}`, { id }));
    return { ok: true as const, proposal: clone(row) };
  });
}

export async function handleChat(actor: Actor, message: string) {
  const text = message.trim().slice(0, 2000);
  const campaigns = await listCampaigns().catch((error: unknown) => {
    const detail = error instanceof Error ? error.message : "Amazon Ads could not be read.";
    return new Error(detail);
  });
  if (campaigns instanceof Error) {
    return {
      text: campaigns.message,
      proposals: [] as Proposal[],
      denied: false,
      source: "ads-api" as const,
    };
  }
  const plan = planMessage(text, campaigns);
  if (plan.kind === "denied") {
    const event = await recordDenied(actor, plan.deny, { message: text });
    return {
      text: plan.deny.message,
      proposals: [] as Proposal[],
      denied: true,
      auditId: event.id,
      source: "policy" as const,
    };
  }
  if (plan.kind === "reply") {
    return { text: plan.message, proposals: [] as Proposal[], denied: false, source: "planner" as const };
  }
  if (plan.kind === "proposal") {
    const created = await proposeAction(actor, plan.action, text);
    if (!created.ok) {
      return { text: created.error, proposals: [] as Proposal[], denied: Boolean(created.deny), source: "policy" as const };
    }
    return {
      text: plan.message,
      proposals: [created.proposal],
      denied: false,
      source: "planner" as const,
    };
  }
  const model = await runModelIfConfigured(actor, text, campaigns);
  return model;
}

export async function exportDataset(dataset: string): Promise<{ filename: string; body: string } | null> {
  const view = await workspace({ id: "export", label: "export" });
  if (dataset === "campaigns") {
    return {
      filename: "sot-ads-campaigns.csv",
      body: toCsv(
        ["campaignId", "name", "state", "targetingType", "dailyBudget", "spend", "sales", "clicks", "impressions", "simulated"],
        view.campaigns.map((campaign) => [
          campaign.campaignId,
          campaign.name,
          campaign.state,
          campaign.targetingType,
          campaign.dailyBudget,
          campaign.spend,
          campaign.sales,
          campaign.clicks,
          campaign.impressions,
          campaign.simulated,
        ]),
      ),
    };
  }
  if (dataset === "keywords") {
    const rows = view.campaigns.flatMap((campaign) =>
      campaign.keywords.map((keyword) => [
        campaign.campaignId,
        campaign.name,
        keyword.keywordId,
        keyword.keywordText,
        keyword.matchType,
        keyword.bid,
        keyword.state,
        keyword.negative,
      ]),
    );
    return {
      filename: "sot-ads-keywords.csv",
      body: toCsv(
        ["campaignId", "campaignName", "keywordId", "keywordText", "matchType", "bid", "state", "negative"],
        rows,
      ),
    };
  }
  if (dataset === "audit") {
    const audit = await withStore((bucket) => clone(bucket.audit));
    return {
      filename: "sot-ads-audit.csv",
      body: toCsv(
        ["id", "at", "actorLabel", "mode", "actionType", "status", "summary"],
        audit.map((event) => [
          event.id,
          event.at,
          event.actorLabel,
          event.mode,
          event.actionType,
          event.status,
          event.summary,
        ]),
      ),
    };
  }
  return null;
}

async function runModelIfConfigured(actor: Actor, text: string, campaigns: Campaign[]) {
  if (!process.env.VERCEL && !process.env.AI_GATEWAY_API_KEY) {
    return {
      text: planMessage(text, campaigns).kind === "unsure"
        ? unsureHint(campaigns)
        : unsureHint(campaigns),
      proposals: [] as Proposal[],
      denied: false,
      source: "planner" as const,
    };
  }
  try {
    const { runAdsAgent } = await import("./agent");
    return await runAdsAgent(actor, text, campaigns);
  } catch (error) {
    console.error("ads agent failed", error instanceof Error ? error.message : "unknown");
    return {
      text: unsureHint(campaigns),
      proposals: [] as Proposal[],
      denied: false,
      source: "fallback" as const,
    };
  }
}

function unsureHint(campaigns: Campaign[]): string {
  const names = campaigns.map((campaign) => campaign.name).join(", ");
  return `I can list campaigns, change a budget, turn a campaign on or off, or add a keyword. Try “set budget of ${campaigns[0]?.name ?? "a campaign"} to 40”. Campaigns in view: ${names}. Nothing was changed.`;
}

async function recordDenied(actor: Actor, deny: DenyHit, detail: unknown): Promise<AuditEvent> {
  return withStore((bucket) => {
    const event = auditFrom(actor, "denied", deny.rule, deny.message, detail);
    bucket.audit.push(event);
    return clone(event);
  });
}

function auditFrom(
  actor: Actor,
  status: AuditEvent["status"],
  actionType: string,
  summary: string,
  detail: unknown,
): AuditEvent {
  return {
    id: `aud-${randomUUID()}`,
    at: new Date().toISOString(),
    actorId: actor.id,
    actorLabel: actor.label,
    mode: adsMode(),
    actionType,
    status,
    summary,
    detail,
  };
}

async function applyAction(action: AdsAction): Promise<ApplyResult> {
  if (adsMode() === "live") {
    const applied = await amazonApply(action);
    return { mode: "live", summary: applied.summary, before: applied.before, after: applied.after };
  }
  return withStore((bucket) => {
    const applied = applySimulated(bucket.campaigns, action);
    return { mode: "dry-run" as const, summary: applied.summary, before: applied.before, after: applied.after };
  });
}

function applySimulated(campaigns: Campaign[], action: AdsAction): {
  summary: string;
  before: unknown;
  after: unknown;
} {
  if (action.type === "create_campaign") {
    const campaignId = `sim-cmp-${randomUUID().slice(0, 8)}`;
    const created: Campaign = {
      campaignId,
      name: action.name,
      state: action.state,
      targetingType: action.targetingType,
      dailyBudget: action.dailyBudget,
      spend: 0,
      sales: 0,
      clicks: 0,
      impressions: 0,
      simulated: true,
      adGroupId: `sim-ag-${campaignId}`,
      keywords: [],
    };
    campaigns.push(created);
    return {
      summary: `Dry-run created “${action.name}” (${action.state}) at $${action.dailyBudget.toFixed(2)}/day. No Amazon spend occurred.`,
      before: null,
      after: publicCampaign(created),
    };
  }

  if (action.type === "set_budget") {
    const campaign = requireCampaign(campaigns, action.campaignId);
    const before = publicCampaign(campaign);
    campaign.dailyBudget = action.dailyBudget;
    return {
      summary: `Dry-run set ${campaign.name} daily budget from $${before.dailyBudget.toFixed(2)} to $${campaign.dailyBudget.toFixed(2)}. No Amazon spend occurred.`,
      before,
      after: publicCampaign(campaign),
    };
  }

  if (action.type === "set_campaign_state") {
    const before = action.campaignIds.map((id) => publicCampaign(requireCampaign(campaigns, id)));
    for (const id of action.campaignIds) {
      requireCampaign(campaigns, id).state = action.state;
    }
    const after = action.campaignIds.map((id) => publicCampaign(requireCampaign(campaigns, id)));
    return {
      summary: `Dry-run set ${action.campaignIds.length} campaign(s) to ${action.state}. Nothing was deleted.`,
      before,
      after,
    };
  }

  if (action.type === "update_campaign") {
    const campaign = requireCampaign(campaigns, action.campaignId);
    const before = publicCampaign(campaign);
    if (action.name) campaign.name = action.name;
    if (action.state) campaign.state = action.state;
    return {
      summary: `Dry-run updated ${campaign.name}.`,
      before,
      after: publicCampaign(campaign),
    };
  }

  const campaign = requireCampaign(campaigns, action.campaignId);
  const before = campaign.keywords.map(publicKeyword);
  for (const input of action.keywords) {
    const existing = campaign.keywords.find(
      (keyword) =>
        keyword.keywordId === input.keywordId ||
        (keyword.keywordText.toLowerCase() === input.keywordText.toLowerCase() &&
          keyword.matchType === input.matchType &&
          keyword.negative === Boolean(input.negative)),
    );
    if (existing) {
      existing.bid = input.bid;
      existing.state = input.state;
      existing.keywordText = input.keywordText;
      existing.matchType = input.matchType;
      existing.negative = Boolean(input.negative);
    } else {
      campaign.keywords.push({
        keywordId: `sim-kw-${randomUUID().slice(0, 8)}`,
        campaignId: campaign.campaignId,
        adGroupId: campaign.adGroupId,
        keywordText: input.keywordText,
        matchType: input.matchType,
        bid: input.bid,
        state: input.state,
        negative: Boolean(input.negative),
      });
    }
  }
  return {
    summary: `Dry-run updated ${action.keywords.length} keyword(s) on ${campaign.name}.`,
    before,
    after: campaign.keywords.map(publicKeyword),
  };
}

function requireCampaign(campaigns: Campaign[], id: string): Campaign {
  const campaign = campaigns.find((item) => item.campaignId === id);
  if (!campaign) throw new AdsApiError(`No campaign ${id} is in this view.`, 404);
  return campaign;
}

function publicCampaign(campaign: Campaign) {
  return {
    campaignId: campaign.campaignId,
    name: campaign.name,
    state: campaign.state,
    dailyBudget: campaign.dailyBudget,
    targetingType: campaign.targetingType,
  };
}

function publicKeyword(keyword: Keyword) {
  return {
    keywordId: keyword.keywordId,
    keywordText: keyword.keywordText,
    matchType: keyword.matchType,
    bid: keyword.bid,
    state: keyword.state,
    negative: keyword.negative,
  };
}

export function describeAction(action: AdsAction, campaigns: Campaign[]): string {
  const name = (id: string) => campaigns.find((item) => item.campaignId === id)?.name ?? id;
  switch (action.type) {
    case "create_campaign":
      return `Create ${action.state} campaign “${action.name}” at $${action.dailyBudget.toFixed(2)}/day`;
    case "set_budget":
      return `Set ${name(action.campaignId)} daily budget to $${action.dailyBudget.toFixed(2)}`;
    case "set_campaign_state":
      return `${action.state === "PAUSED" ? "Pause" : "Enable"} ${action.campaignIds.map(name).join(", ")}`;
    case "update_campaign":
      return `Update ${name(action.campaignId)}`;
    case "upsert_keywords":
      return `Change ${action.keywords.length} keyword(s) on ${name(action.campaignId)}`;
    default:
      return "Amazon Ads change";
  }
}

export type { Plan };
