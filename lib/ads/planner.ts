import { researchReply } from "./insights";
import { BLOCKED_TOOL_MESSAGE, looksLikeAdsWork, isGreeting, SCOPE_INTRO, screenText, type DenyHit } from "./policy";
import type { AdsAction, Campaign, DeliveryState, MatchType, TargetingType } from "./types";

export type Plan =
  | { kind: "denied"; deny: DenyHit }
  | { kind: "reply"; message: string }
  | { kind: "proposal"; message: string; summary: string; action: AdsAction }
  | { kind: "unsure"; hint: string };

const moneyPattern = "\\$?(\\d+(?:\\.\\d{1,2})?)";

export function planMessage(text: string, campaigns: Campaign[]): Plan {
  const raw = text.trim();
  if (!raw) return { kind: "reply", message: "Say what you want in Amazon PPC, Sellerboard, or Helium 10." };
  const deny = screenText(raw);
  if (deny) return { kind: "denied", deny };
  if (isGreeting(raw)) return { kind: "reply", message: SCOPE_INTRO };
  if (/\b(export|download|csv)\b/i.test(raw)) {
    return {
      kind: "reply",
      message:
        "Use the CSV buttons for campaigns, keywords, or the audit log. Exports are downloads only. Nothing on the account is changed.",
    };
  }

  const researchFirst = researchReply(raw);
  if (researchFirst && !looksLikeAdsWork(raw)) return { kind: "reply", message: researchFirst };

  const list = findList(raw, campaigns);
  if (list) return list;
  const budget = findBudget(raw, campaigns);
  if (budget) return budget;
  const state = findState(raw, campaigns);
  if (state) return state;
  const created = findCreate(raw);
  if (created) return created;
  const keyword = findKeyword(raw, campaigns);
  if (keyword) return keyword;

  const research = researchReply(raw);
  if (research) return { kind: "reply", message: research };

  if (looksLikeAdsWork(raw)) {
    return {
      kind: "unsure",
      hint: `${SCOPE_INTRO} I could not map that sentence to one change. Name the campaign and the budget, keyword, or on/off switch.`,
    };
  }
  return {
    kind: "denied",
    deny: { rule: "out-of-scope", message: BLOCKED_TOOL_MESSAGE },
  };
}

function findList(text: string, campaigns: Campaign[]): Plan | null {
  if (!looksLikeAdsWork(text) && !/\b(list|show)\b/i.test(text)) return null;
  if (!/\b(list|show|what|which|how much|performance|results|spend|status|campaigns?)\b/i.test(text)) {
    return null;
  }
  if (/\b(set|change|update|create|add|pause|enable|turn)\b/i.test(text) && /\b(budget|keyword|bid)\b/i.test(text)) {
    return null;
  }
  if (!campaigns.length) {
    return { kind: "reply", message: "No campaigns are in this view yet." };
  }
  const lines = campaigns.map((campaign) => {
    const spend = campaign.spend == null ? "spend not in this response" : `spend $${campaign.spend.toFixed(2)}`;
    const sales = campaign.sales == null ? "sales n/a" : `sales $${campaign.sales.toFixed(2)}`;
    const acos =
      campaign.spend != null && campaign.sales
        ? `ACoS ${((campaign.spend / campaign.sales) * 100).toFixed(1)}%`
        : "ACoS n/a";
    return `${campaign.name} (${campaign.campaignId}) is ${campaign.state}, daily budget $${campaign.dailyBudget.toFixed(2)}, ${spend}, ${sales}, ${acos}.`;
  });
  const note = campaigns.some((campaign) => campaign.simulated)
    ? " These figures are simulated until the Amazon Ads API is connected."
    : " Spend and sales are blank here because this view reads campaign settings, not an async Amazon report.";
  return { kind: "reply", message: `${lines.join(" ")} ${note}` };
}

function findBudget(text: string, campaigns: Campaign[]): Plan | null {
  const match =
    text.match(new RegExp(`budget\\s+(?:on|for|of)\\s+(.+?)\\s+to\\s+${moneyPattern}`, "i")) ||
    text.match(new RegExp(`(?:set|change|update|raise|lower).{0,48}budget.{0,48}to\\s+${moneyPattern}.{0,24}(?:on|for|of)\\s+(.+)`, "i"));
  if (!match) return null;
  const namedSecond = match[2] && /[a-z]/i.test(match[1] || "") && /^\d/.test(match[2]);
  const name = (namedSecond ? match[1] : match[2] || match[1]).replace(/[.?!]+$/, "").trim();
  const amount = Number(namedSecond ? match[2] : match[1] && /^\d/.test(match[1]) ? match[1] : match[2]);
  if (!name || !Number.isFinite(amount)) return null;
  const resolved = resolveCampaign(campaigns, name);
  if ("error" in resolved) return { kind: "reply", message: resolved.error };
  return {
    kind: "proposal",
    summary: `Set ${resolved.campaign.name} daily budget to $${amount.toFixed(2)}`,
    message: `I prepared a budget change for ${resolved.campaign.name}: $${resolved.campaign.dailyBudget.toFixed(2)} → $${amount.toFixed(2)} per day. Confirm it before it runs. Spend is Shakeel Amir’s.`,
    action: {
      type: "set_budget",
      campaignId: resolved.campaign.campaignId,
      dailyBudget: amount,
    },
  };
}

function findState(text: string, campaigns: Campaign[]): Plan | null {
  const enable = /\b(enable|resume|turn on|switch on)\b/i.test(text);
  const pause = /\b(pause|turn off|switch off|stop spending)\b/i.test(text);
  if (enable === pause) return null;
  const state: DeliveryState = pause ? "PAUSED" : "ENABLED";
  if (/\ball campaigns\b/i.test(text)) {
    return {
      kind: "proposal",
      summary: `${state === "PAUSED" ? "Pause" : "Enable"} all ${campaigns.length} campaigns`,
      message: `I prepared turning ${state === "PAUSED" ? "off" : "on"} every campaign in this account view. Confirm to apply it. Nothing is deleted.`,
      action: {
        type: "set_campaign_state",
        campaignIds: campaigns.map((campaign) => campaign.campaignId),
        state,
      },
    };
  }
  const name = text
    .replace(/\b(please|can you|could you|enable|resume|pause|turn on|turn off|switch on|switch off|stop spending|the campaign|campaign)\b/gi, " ")
    .replace(/[.?!]+$/, "")
    .trim();
  if (!name) return { kind: "reply", message: "Name the campaign to turn on or off." };
  const resolved = resolveCampaign(campaigns, name);
  if ("error" in resolved) return { kind: "reply", message: resolved.error };
  const verb = state === "PAUSED" ? "Pause" : "Enable";
  return {
    kind: "proposal",
    summary: `${verb} ${resolved.campaign.name}`,
    message: `${verb} ${resolved.campaign.name}? It is ${resolved.campaign.state} now. Confirm and I will send only that on/off change.`,
    action: {
      type: "set_campaign_state",
      campaignIds: [resolved.campaign.campaignId],
      state,
    },
  };
}

function findCreate(text: string): Plan | null {
  const match = text.match(
    new RegExp(
      `\\b(?:create|launch|make)\\b[\\s\\S]{0,24}\\bcampaign\\b\\s+(.+?)\\s+(?:with\\s+)?(?:a\\s+)?(?:daily\\s+)?budget\\s+(?:of\\s+)?${moneyPattern}`,
      "i",
    ),
  );
  if (!match) return null;
  const name = match[1].replace(/^["']|["']$/g, "").trim();
  const dailyBudget = Number(match[2]);
  const targetingType: TargetingType = /\bauto\b/i.test(text) ? "AUTO" : "MANUAL";
  const state: DeliveryState = /\b(enable|turn it on|start (it|spend))\b/i.test(text) ? "ENABLED" : "PAUSED";
  return {
    kind: "proposal",
    summary: `Create ${state === "PAUSED" ? "paused " : ""}campaign “${name}” at $${dailyBudget.toFixed(2)}/day`,
    message: `I prepared a new ${targetingType.toLowerCase()} campaign “${name}” at $${dailyBudget.toFixed(2)} per day, starting ${state}. Confirm to create it. It will not delete anything.`,
    action: { type: "create_campaign", name, dailyBudget, targetingType, state },
  };
}

function findKeyword(text: string, campaigns: Campaign[]): Plan | null {
  const match = text.match(
    new RegExp(
      `\\b(?:add|create|update|change|set)\\b[\\s\\S]{0,40}\\b(exact|phrase|broad)?\\s*keyword\\s+["“']?(.+?)["”']?\\s+(?:to|on|for)\\s+(.+?)\\s+(?:at|bid)\\s+${moneyPattern}`,
      "i",
    ),
  );
  if (!match) return null;
  const matchType = ((match[1] || "EXACT").toUpperCase() || "EXACT") as MatchType;
  const keywordText = match[2].trim();
  const resolved = resolveCampaign(campaigns, match[3].trim());
  if ("error" in resolved) return { kind: "reply", message: resolved.error };
  const bid = Number(match[4]);
  return {
    kind: "proposal",
    summary: `Add ${matchType} keyword “${keywordText}” on ${resolved.campaign.name} at $${bid.toFixed(2)}`,
    message: `I prepared keyword “${keywordText}” (${matchType}) on ${resolved.campaign.name} with bid $${bid.toFixed(2)}. Confirm before it is sent.`,
    action: {
      type: "upsert_keywords",
      campaignId: resolved.campaign.campaignId,
      keywords: [{ keywordText, matchType, bid, state: "ENABLED", negative: false }],
    },
  };
}

export function resolveCampaign(
  campaigns: Campaign[],
  query: string,
): { campaign: Campaign } | { error: string } {
  const needle = query.replace(/^["']|["']$/g, "").trim().toLowerCase();
  if (!needle) return { error: "Name the campaign." };
  const exact = campaigns.filter(
    (campaign) =>
      campaign.name.toLowerCase() === needle || campaign.campaignId.toLowerCase() === needle,
  );
  if (exact.length === 1) return { campaign: exact[0] };
  const partial = campaigns.filter(
    (campaign) =>
      campaign.name.toLowerCase().includes(needle) || needle.includes(campaign.name.toLowerCase()),
  );
  if (partial.length === 1) return { campaign: partial[0] };
  if (partial.length > 1) {
    return {
      error: `More than one campaign matches “${query}”: ${partial.map((c) => c.name).join(", ")}.`,
    };
  }
  return {
    error: `No campaign is named “${query}”. Ask me to list campaigns first.`,
  };
}
