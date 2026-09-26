import { randomUUID } from "node:crypto";
import { AdsApiError, amazonApply, amazonListCampaigns } from "./amazon";
import { publicCaps } from "./caps";
import { actionCampaignIds, compareOutcome, formatExpected, parseChallenge, readActual } from "./challenge";
import { attachKits, CATALOG, findKit, groupByKit, resolveKit } from "./catalog";
import { adsMode } from "./mode";
import { redactSecrets, redactUnknown } from "./redact";
import { parseAction, type DenyHit } from "./policy";
import { planMessage, type Plan } from "./planner";
import { applySimulated } from "./simulate";
import { clone, withStore } from "./store";
import { toCsv } from "./csv";
import type { Actor, AdsAction, ApplyResult, AuditEvent, Campaign, DecisionChallenge, Proposal } from "./types";

const PROPOSAL_TTL_MS = 30 * 60 * 1000;

export async function listCampaigns(): Promise<Campaign[]> {
  if (adsMode() === "live") return amazonListCampaigns();
  return withStore((bucket) => attachKits(clone(bucket.campaigns)));
}

export async function workspace(actor: Actor) {
  const mode = adsMode();
  const campaigns = await listCampaigns();
  const side = await withStore((bucket) => ({
    proposals: bucket.proposals.filter((item) => item.actorId === actor.id).slice(-20),
    audit: bucket.audit.slice(-40).reverse(),
    checks: bucket.feedback.slice(-30).reverse(),
  }));
  return {
    mode,
    actorLabel: actor.label,
    spendOwner: "Shakeel Amir",
    account: "Sensationally OT",
    simulated: mode === "dry-run",
    sampleData: mode === "dry-run",
    connectionLabel: mode === "dry-run" ? "API not connected" : "Live Ads API",
    caps: publicCaps(),
    connectHint:
      mode === "dry-run"
        ? "API not connected. Kit rows marked Sample are not live Amazon data. Confirm still asks for the bet, and nothing is sent to Amazon."
        : "Connected to the Amazon Advertising API for Sponsored Products. Writes still wait for a named bet and confirmation. Sponsored Brands and Sponsored Display are not connected.",
    catalog: CATALOG,
    kits: groupByKit(campaigns),
    campaigns,
    proposals: side.proposals,
    audit: side.audit,
    checks: side.checks,
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

export async function confirmProposal(actor: Actor, id: string, challengeInput?: unknown) {
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
  const campaigns = await listCampaigns().catch(() => [] as Campaign[]);
  const challenge = parseChallenge(challengeInput, pending.summary, campaigns, recheck.action);
  if (!challenge.ok) return challenge;

  try {
    const result = await applyAction(recheck.action);
    const saved = await withStore((bucket) => {
      const row = bucket.proposals.find((item) => item.id === id);
      if (!row || row.status !== "pending") return null;
      row.status = "applied";
      row.challenge = challenge.challenge;
      row.result = result;
      const event = auditFrom(actor, "applied", recheck.action.type, result.summary, result, challenge.challenge);
      bucket.audit.push(event);
      bucket.feedback.push(feedbackFrom(actor, row, challenge.challenge, campaigns));
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
      bucket.audit.push(auditFrom(actor, "failed", recheck.action.type, message, { id }, challenge.challenge));
    });
    return { ok: false as const, status: 502, error: message };
  }
}

export async function recordFeedback(actor: Actor, input: unknown) {
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const id = typeof body.id === "string" ? body.id : "";
  const parsed = readActual(body);
  if (!id) return { ok: false as const, status: 400, error: "Name the check you are closing." };
  if (!parsed.ok) return { ok: false as const, status: 400, error: parsed.error };
  return withStore((bucket) => {
    const row = bucket.feedback.find((item) => item.id === id);
    if (!row) return { ok: false as const, status: 404, error: "That check was not found." };
    if (row.status === "recorded") {
      return { ok: false as const, status: 409, error: "This check already has a result." };
    }
    const actual = { ...parsed.actual, recordedAt: new Date().toISOString() };
    row.actual = actual;
    row.status = "recorded";
    row.comparison = compareOutcome(row.challenge, actual, row.reviewAfter);
    const summary = `Feedback on ${row.kitName}: ${row.comparison.verdict}. ${row.comparison.lines[0] ?? ""}`.trim();
    bucket.audit.push(auditFrom(actor, "applied", "feedback_check", summary, { id, comparison: row.comparison }, row.challenge));
    return { ok: true as const, check: clone(row) };
  });
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
    return publishChat({
      text: campaigns.message,
      proposals: [] as Proposal[],
      denied: false,
      source: "ads-api" as const,
    });
  }
  const plan = planMessage(text, campaigns);
  if (plan.kind === "denied") {
    const event = await recordDenied(actor, plan.deny, { message: text });
    return publishChat({
      text: plan.deny.message,
      proposals: [] as Proposal[],
      denied: true,
      auditId: event.id,
      source: "policy" as const,
    });
  }
  if (plan.kind === "reply") {
    return publishChat({ text: plan.message, proposals: [] as Proposal[], denied: false, source: "planner" as const });
  }
  if (plan.kind === "proposal") {
    const created = await proposeAction(actor, plan.action, text);
    if (!created.ok) {
      return publishChat({
        text: created.error,
        proposals: [] as Proposal[],
        denied: Boolean(created.deny),
        source: "policy" as const,
      });
    }
    return publishChat({
      text: plan.message,
      proposals: [created.proposal],
      denied: false,
      source: "planner" as const,
    });
  }
  const model = await runModelIfConfigured(actor, text, campaigns);
  return publishChat(model);
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
    const negativeRows = view.campaigns.flatMap((campaign) =>
      (campaign.negatives ?? []).map((entry) => [
        campaign.campaignId,
        campaign.name,
        entry.entryId,
        entry.value,
        entry.matchType,
        "",
        entry.state,
        true,
      ]),
    );
    return {
      filename: "sot-ads-keywords.csv",
      body: toCsv(
        ["campaignId", "campaignName", "keywordId", "keywordText", "matchType", "bid", "state", "negative"],
        [...rows, ...negativeRows],
      ),
    };
  }
  if (dataset === "audit") {
    const audit = await withStore((bucket) => clone(bucket.audit));
    return {
      filename: "sot-ads-audit.csv",
      body: toCsv(
        ["id", "at", "actorLabel", "mode", "actionType", "status", "summary", "intent", "expected", "challengeStrength"],
        audit.map((event) => [
          event.id,
          event.at,
          event.actorLabel,
          event.mode,
          event.actionType,
          event.status,
          event.summary,
          event.intent ?? "",
          event.expected ?? "",
          event.challengeStrength ?? "",
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
    console.error("ads agent failed", redactSecrets(error instanceof Error ? error.message : "unknown"));
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
  return `Access is limited to Amazon PPC, Sellerboard, and Helium 10. I can list campaigns, change a budget, turn a campaign on or off, add a keyword, or read Sellerboard and Helium 10 analysis. Try “set budget of ${campaigns[0]?.name ?? "a campaign"} to 40”. Campaigns in view: ${names}. Nothing was changed.`;
}

function publishChat<T extends { text: string }>(result: T): T {
  return { ...result, text: redactSecrets(result.text) };
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
  challenge?: DecisionChallenge,
): AuditEvent {
  return {
    id: `aud-${randomUUID()}`,
    at: new Date().toISOString(),
    actorId: actor.id,
    actorLabel: actor.label,
    mode: adsMode(),
    actionType,
    status,
    summary: redactSecrets(summary),
    intent: challenge?.intent ?? "",
    expected: challenge ? formatExpected(challenge) : "",
    challengeStrength: challenge?.strength ?? "",
    detail: redactUnknown(challenge ? { detail, challenge } : detail),
  };
}

function feedbackFrom(actor: Actor, proposal: Proposal, challenge: DecisionChallenge, campaigns: Campaign[]) {
  const ids = actionCampaignIds(proposal.action);
  const kit =
    (proposal.action.type === "create_campaign" ? findKit(proposal.action.kitId) : null) ||
    campaigns.map((campaign) => (ids.includes(campaign.campaignId) ? resolveKit(campaign) : null)).find(Boolean) ||
    null;
  const reviewAfter = new Date(Date.now() + challenge.timelineDays * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: `chk-${randomUUID()}`,
    proposalId: proposal.id,
    at: new Date().toISOString(),
    reviewAfter,
    actorId: actor.id,
    actorLabel: actor.label,
    kitId: kit?.kitId ?? null,
    kitName: kit?.name ?? "Not tied to a kit",
    summary: proposal.summary,
    mode: adsMode(),
    challenge,
    status: "awaiting" as const,
    actual: null,
    comparison: null,
  };
}

async function applyAction(action: AdsAction): Promise<ApplyResult> {
  if (adsMode() === "live") {
    const applied = await amazonApply(action);
    return {
      mode: "live",
      summary: redactSecrets(applied.summary),
      before: redactUnknown(applied.before),
      after: redactUnknown(applied.after),
    };
  }
  return withStore((bucket) => {
    const applied = applySimulated(bucket.campaigns, action);
    return { mode: "dry-run" as const, summary: applied.summary, before: applied.before, after: applied.after };
  });
}

export function describeAction(action: AdsAction, campaigns: Campaign[]): string {
  const name = (id: string) => campaigns.find((item) => item.campaignId === id)?.name ?? id;
  switch (action.type) {
    case "create_campaign": {
      const kit = findKit(action.kitId);
      const onKit = kit ? ` for ${kit.name}` : " with no kit";
      return `Create ${action.state} campaign “${action.name}”${onKit} at $${action.dailyBudget.toFixed(2)}/day`;
    }
    case "set_budget":
      return `Set ${name(action.campaignId)} daily budget to $${action.dailyBudget.toFixed(2)}`;
    case "set_campaign_state":
      return `${action.state === "PAUSED" ? "Pause" : "Enable"} ${action.campaignIds.map(name).join(", ")}`;
    case "update_campaign":
      return `Update ${name(action.campaignId)}`;
    case "upsert_keywords":
      return `Change ${action.keywords.length} keyword(s) on ${name(action.campaignId)}`;
    case "update_keyword":
      return `Update keyword ${action.keywordId} on ${name(action.campaignId)}${action.bid != null ? ` bid $${action.bid.toFixed(2)}` : ""} ${action.state ?? ""}`.trim();
    case "add_keyword":
      return `Add ${action.matchType} keyword “${action.keywordText}” on ${name(action.campaignId)} at $${action.bid.toFixed(2)}`;
    case "add_negative":
      return `Add negative ${action.kind === "ASIN" ? action.asin : action.keywordText} on ${name(action.campaignId)} (${action.scope})`;
    case "apply_search_term":
      return `Apply search term “${action.searchTerm}” as ${action.as} on ${name(action.campaignId)}`;
    case "upsert_product_target":
      return `${action.targetId ? "Update" : "Add"} product target ${action.asin} on ${name(action.campaignId)}`;
    case "manage_product_ad":
      return `${action.adId ? "Set" : "Add"} product ad ${action.asin || action.sku || action.adId} ${action.state} on ${name(action.campaignId)}`;
    default:
      return "Amazon Ads change";
  }
}

export type { Plan };
