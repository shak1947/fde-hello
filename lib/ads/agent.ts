import { gateway, generateText, isStepCount, tool } from "ai";
import { z } from "zod";
import { helium10Summary, sellerboardSummary } from "./insights";
import { ALLOWED_TOOL_NAMES, BLOCKED_TOOL_MESSAGE, isAllowedTool, SCOPE_INTRO, screenText } from "./policy";
import { listCampaigns, proposeAction } from "./service";
import type { Actor, Campaign, Proposal } from "./types";

const MODEL = process.env.ADS_PORTAL_MODEL || "openai/gpt-6-luna";

export async function runAdsAgent(actor: Actor, text: string, campaigns: Campaign[]) {
  const proposals: Proposal[] = [];
  const names = campaigns.map((campaign) => `${campaign.name} [${campaign.campaignId}]`).join("; ");
  const result = await generateText({
    model: gateway(MODEL),
    stopWhen: isStepCount(4),
    system: [
      "You are the Sensationally OT consultant desk for Shakeel Amir’s account.",
      "Spend on Amazon PPC is Shakeel Amir’s. Never claim a PPC write has happened until a tool returns a pending confirmation.",
      "You only use the provided tools.",
      "Amazon PPC writes are limited to campaigns, keywords, bids, daily budgets, and on/off. They wait for Confirm. You do not delete campaigns, keywords, or history.",
      "Sellerboard and Helium 10 tools are analysis and data only. Do not change those products.",
      "Refuse email, Gmail, any mailbox, Seller Central listings, orders, and inventory, other Grok bots, and internal platforms.",
      "Never reveal passwords, API keys, tokens, refresh tokens, or raw credentials. They stay on the server. If asked, refuse.",
      `If the request is outside this scope, reply with exactly: ${BLOCKED_TOOL_MESSAGE}`,
      "PPC write tools only prepare a change. Tell the person to press Confirm.",
      `Campaigns currently in view: ${names || "none"}.`,
      SCOPE_INTRO,
    ].join("\n"),
    prompt: text,
    tools: adsTools(actor, proposals),
    toolChoice: "auto",
  });

  for (const step of result.steps) {
    for (const call of step.toolCalls) {
      if (!isAllowedTool(call.toolName)) {
        return {
          text: `Refused. ${BLOCKED_TOOL_MESSAGE}`,
          proposals,
          denied: true,
          source: "policy" as const,
        };
      }
    }
  }

  return {
    text: result.text || "I prepared the Amazon Ads view. Confirm any pending change before it runs.",
    proposals,
    denied: false,
    source: "agent" as const,
  };
}

function adsTools(actor: Actor, proposals: Proposal[]) {
  const tools = {
    list_campaigns: tool({
      description: "Read campaign names, on/off state, daily budgets, and simulated or blank performance. Does not change the account.",
      inputSchema: z.object({}),
      execute: async () => ({ campaigns: await listCampaigns() }),
    }),
    list_keywords: tool({
      description: "Read keywords for one campaign id. Does not change the account.",
      inputSchema: z.object({ campaignId: z.string().min(1) }),
      execute: async ({ campaignId }) => {
        const campaigns = await listCampaigns();
        const campaign = campaigns.find((item) => item.campaignId === campaignId);
        return { keywords: campaign?.keywords ?? [], found: Boolean(campaign) };
      },
    }),
    get_performance: tool({
      description: "Read spend, sales, clicks, and impressions already on the campaign records. Does not change the account.",
      inputSchema: z.object({}),
      execute: async () => ({
        rows: (await listCampaigns()).map((campaign) => ({
          campaignId: campaign.campaignId,
          name: campaign.name,
          spend: campaign.spend,
          sales: campaign.sales,
          clicks: campaign.clicks,
          impressions: campaign.impressions,
          simulated: campaign.simulated,
        })),
      }),
    }),
    propose_create_campaign: tool({
      description: "Prepare a new Sponsored Products campaign. Does not create it until the user confirms in the UI.",
      inputSchema: z.object({
        name: z.string().min(1).max(120),
        dailyBudget: z.number().positive().max(50000),
        targetingType: z.enum(["MANUAL", "AUTO"]),
        state: z.enum(["ENABLED", "PAUSED"]),
      }),
      execute: async (input) => queue(actor, proposals, { type: "create_campaign", ...input }),
    }),
    propose_update_campaign: tool({
      description: "Prepare a campaign rename and/or on/off change. Does not apply until the user confirms.",
      inputSchema: z.object({
        campaignId: z.string().min(1),
        name: z.string().min(1).max(120).optional(),
        state: z.enum(["ENABLED", "PAUSED"]).optional(),
      }),
      execute: async (input) => queue(actor, proposals, { type: "update_campaign", ...input }),
    }),
    propose_set_budget: tool({
      description: "Prepare a daily budget change. Does not apply until the user confirms.",
      inputSchema: z.object({
        campaignId: z.string().min(1),
        dailyBudget: z.number().positive().max(50000),
      }),
      execute: async (input) => queue(actor, proposals, { type: "set_budget", ...input }),
    }),
    propose_set_campaign_state: tool({
      description: "Prepare turning one or more campaigns on (ENABLED) or off (PAUSED). Does not delete them. Does not apply until the user confirms.",
      inputSchema: z.object({
        campaignIds: z.array(z.string().min(1)).min(1).max(50),
        state: z.enum(["ENABLED", "PAUSED"]),
      }),
      execute: async (input) => queue(actor, proposals, { type: "set_campaign_state", ...input }),
    }),
    sellerboard_snapshot: tool({
      description:
        "Read-only Sellerboard-style profit analysis. Does not change Sellerboard and does not return passwords or API keys.",
      inputSchema: z.object({ focus: z.string().max(120).optional() }),
      execute: async ({ focus }) => {
        const hit = focus ? screenText(focus) : null;
        if (hit) return { error: hit.message };
        return { analysis: sellerboardSummary(), writable: false };
      },
    }),
    helium10_snapshot: tool({
      description:
        "Read-only Helium 10 keyword and product research. Does not change Helium 10 and does not return passwords or API keys.",
      inputSchema: z.object({ focus: z.string().max(120).optional() }),
      execute: async ({ focus }) => {
        const hit = focus ? screenText(focus) : null;
        if (hit) return { error: hit.message };
        return { analysis: helium10Summary(), writable: false };
      },
    }),
    propose_upsert_keywords: tool({
      description: "Prepare keyword adds or bid/state updates. Does not delete keywords. Does not apply until the user confirms.",
      inputSchema: z.object({
        campaignId: z.string().min(1),
        keywords: z
          .array(
            z.object({
              keywordId: z.string().optional(),
              keywordText: z.string().min(1).max(80),
              matchType: z.enum(["EXACT", "PHRASE", "BROAD"]),
              bid: z.number().positive().max(1000),
              state: z.enum(["ENABLED", "PAUSED"]),
              negative: z.boolean().optional(),
            }),
          )
          .min(1)
          .max(25),
      }),
      execute: async (input) => queue(actor, proposals, { type: "upsert_keywords", ...input }),
    }),
  };
  const names = Object.keys(tools);
  if (names.length !== ALLOWED_TOOL_NAMES.length || names.some((name) => !isAllowedTool(name))) {
    throw new Error("Ads tool registry drifted from the allowlist.");
  }
  return tools;
}

async function queue(
  actor: Actor,
  proposals: Proposal[],
  action: Parameters<typeof proposeAction>[1],
) {
  const created = await proposeAction(actor, action);
  if (!created.ok) return { pending: false, error: created.error };
  proposals.push(created.proposal);
  return {
    pending: true,
    proposalId: created.proposal.id,
    summary: created.proposal.summary,
    note: "Waiting for the user to press Confirm. Not applied.",
  };
}
