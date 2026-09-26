import { researchReply } from "./insights";
import { adsMode } from "./mode";
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
  if (/\b(sponsored brands|sponsored display)\b/i.test(raw)) {
    return {
      kind: "reply",
      message:
        "Sponsored Brands and Sponsored Display are a follow-up. This desk prepares Sponsored Products changes only, and only after confirmation.",
    };
  }
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

  const search = findSearchTerms(raw);
  if (search) return search;
  const list = findList(raw, campaigns);
  if (list) return list;
  const budget = findBudget(raw, campaigns);
  if (budget) return budget;
  const state = findState(raw, campaigns);
  if (state) return state;
  const created = findCreate(raw);
  if (created) return created;
  const keywordBid = findKeywordBid(raw, campaigns);
  if (keywordBid) return keywordBid;
  const keywordState = findKeywordState(raw, campaigns);
  if (keywordState) return keywordState;
  const negative = findNegative(raw, campaigns);
  if (negative) return negative;
  const product = findProduct(raw, campaigns);
  if (product) return product;
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
  if (/\bsearch terms?\b/i.test(text)) return null;
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
    ? " API not connected. These figures are labeled sample data until the Amazon Ads API is connected."
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
  if (/\b(keyword|negative|asin|product target|product ad|search term)\b/i.test(text)) return null;
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

function findSearchTerms(text: string): Plan | null {
  if (!/\bsearch terms?\b/i.test(text)) return null;
  if (/\b(add|apply|negative|keyword|confirm)\b/i.test(text)) return null;
  if (adsMode() === "live") {
    return {
      kind: "reply",
      message:
        "Use Search terms on the desk to request the Sponsored Products search-term report. Applying a row as a keyword or negative still waits for confirmation.",
    };
  }
  return {
    kind: "reply",
    message:
      "API not connected. Open Search terms on the desk for labeled sample rows. Applying one as a keyword or negative still waits for confirmation. Nothing is sent to Amazon.",
  };
}

function findKeywordBid(text: string, campaigns: Campaign[]): Plan | null {
  const match = text.match(
    new RegExp(
      `\\b(?:set|change|update)\\s+bid\\s+(?:of\\s+|for\\s+)?["“']?(.+?)["”']?\\s+(?:on|to|for)\\s+(.+?)\\s+(?:to|at)\\s+${moneyPattern}`,
      "i",
    ),
  );
  if (!match) return null;
  const keywordText = match[1].trim();
  const resolved = resolveCampaign(campaigns, match[2].trim());
  if ("error" in resolved) return { kind: "reply", message: resolved.error };
  const keyword = resolved.campaign.keywords.find((item) => item.keywordText.toLowerCase() === keywordText.toLowerCase());
  if (!keyword) return { kind: "reply", message: `No keyword “${keywordText}” is on ${resolved.campaign.name}.` };
  const bid = Number(match[3]);
  return {
    kind: "proposal",
    summary: `Set bid for “${keyword.keywordText}” on ${resolved.campaign.name} to $${bid.toFixed(2)}`,
    message: `I prepared a bid change for “${keyword.keywordText}” on ${resolved.campaign.name}: $${keyword.bid.toFixed(2)} → $${bid.toFixed(2)}. Confirm before it is sent.`,
    action: { type: "update_keyword", campaignId: resolved.campaign.campaignId, keywordId: keyword.keywordId, bid },
  };
}

function findKeywordState(text: string, campaigns: Campaign[]): Plan | null {
  if (!/\bkeyword\b/i.test(text)) return null;
  const pause = /\b(pause|turn off|disable)\b/i.test(text);
  const enable = /\b(enable|resume|turn on)\b/i.test(text);
  if (pause === enable) return null;
  const match = text.match(/\bkeyword\s+["“']?(.+?)["”']?\s+(?:on|in|for)\s+(.+)/i);
  if (!match) return null;
  const resolved = resolveCampaign(campaigns, match[2].replace(/[.?!]+$/, "").trim());
  if ("error" in resolved) return { kind: "reply", message: resolved.error };
  const keywordText = match[1].trim();
  const keyword = resolved.campaign.keywords.find((item) => item.keywordText.toLowerCase() === keywordText.toLowerCase());
  if (!keyword) return { kind: "reply", message: `No keyword “${keywordText}” is on ${resolved.campaign.name}.` };
  const state: DeliveryState = pause ? "PAUSED" : "ENABLED";
  return {
    kind: "proposal",
    summary: `${state === "PAUSED" ? "Pause" : "Enable"} keyword “${keyword.keywordText}” on ${resolved.campaign.name}`,
    message: `${state === "PAUSED" ? "Pause" : "Enable"} keyword “${keyword.keywordText}” on ${resolved.campaign.name}? Confirm before it is sent. Nothing is archived.`,
    action: { type: "update_keyword", campaignId: resolved.campaign.campaignId, keywordId: keyword.keywordId, state },
  };
}

function findNegative(text: string, campaigns: Campaign[]): Plan | null {
  const match = text.match(
    /\badd\s+negative\s+(exact|phrase|broad)?\s*(keyword|asin)\s+["“']?(.+?)["”']?\s+(?:to|on|for)\s+(.+)/i,
  );
  if (!match) return null;
  const kind = match[2].toUpperCase() === "ASIN" ? "ASIN" : "KEYWORD";
  const value = match[3].trim();
  const resolved = resolveCampaign(campaigns, match[4].replace(/[.?!]+$/, "").trim());
  if ("error" in resolved) return { kind: "reply", message: resolved.error };
  const scope = /\bcampaign\b/i.test(text) && !/\bad group\b/i.test(text) ? "CAMPAIGN" : "AD_GROUP";
  if (kind === "ASIN") {
    return {
      kind: "proposal",
      summary: `Add negative ASIN ${value.toUpperCase()} on ${resolved.campaign.name}`,
      message: `I prepared a negative ASIN ${value.toUpperCase()} on ${resolved.campaign.name} (${scope}). Confirm before it is sent.`,
      action: {
        type: "add_negative",
        campaignId: resolved.campaign.campaignId,
        adGroupId: scope === "AD_GROUP" ? resolved.campaign.adGroupId : undefined,
        scope,
        kind: "ASIN",
        asin: value.toUpperCase(),
        state: "ENABLED",
      },
    };
  }
  const word = (match[1] || "exact").toUpperCase();
  const matchType = word === "PHRASE" ? "NEGATIVE_PHRASE" : word === "BROAD" ? "NEGATIVE_BROAD" : "NEGATIVE_EXACT";
  return {
    kind: "proposal",
    summary: `Add ${matchType} negative “${value}” on ${resolved.campaign.name}`,
    message: `I prepared negative keyword “${value}” (${matchType}) on ${resolved.campaign.name} at ${scope} scope. Confirm before it is sent.`,
    action: {
      type: "add_negative",
      campaignId: resolved.campaign.campaignId,
      adGroupId: scope === "AD_GROUP" ? resolved.campaign.adGroupId : undefined,
      scope,
      kind: "KEYWORD",
      keywordText: value,
      matchType,
      state: "ENABLED",
    },
  };
}

function findProduct(text: string, campaigns: Campaign[]): Plan | null {
  const target = text.match(
    new RegExp(`\\b(?:add|set)\\s+product\\s+target\\s+(B0[A-Z0-9]{8})\\s+(?:on|to|for)\\s+(.+?)\\s+(?:at|bid)\\s+${moneyPattern}`, "i"),
  );
  if (target) {
    const resolved = resolveCampaign(campaigns, target[2].trim());
    if ("error" in resolved) return { kind: "reply", message: resolved.error };
    const asin = target[1].toUpperCase();
    const bid = Number(target[3]);
    return {
      kind: "proposal",
      summary: `Add product target ${asin} on ${resolved.campaign.name} at $${bid.toFixed(2)}`,
      message: `I prepared product target ${asin} on ${resolved.campaign.name} at $${bid.toFixed(2)}. Confirm before it is sent.`,
      action: {
        type: "upsert_product_target",
        campaignId: resolved.campaign.campaignId,
        adGroupId: resolved.campaign.adGroupId,
        asin,
        bid,
        state: "ENABLED",
      },
    };
  }
  const ad = text.match(/\badd\s+product\s+ad\s+(B0[A-Z0-9]{8})\s+(?:on|to|for)\s+(.+)/i);
  if (!ad) return null;
  const resolved = resolveCampaign(campaigns, ad[2].replace(/[.?!]+$/, "").trim());
  if ("error" in resolved) return { kind: "reply", message: resolved.error };
  const asin = ad[1].toUpperCase();
  return {
    kind: "proposal",
    summary: `Add product ad ${asin} on ${resolved.campaign.name}`,
    message: `I prepared product ad ${asin} on ${resolved.campaign.name}, starting paused. Confirm before it is sent.`,
    action: {
      type: "manage_product_ad",
      campaignId: resolved.campaign.campaignId,
      adGroupId: resolved.campaign.adGroupId,
      asin,
      state: "PAUSED",
    },
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
