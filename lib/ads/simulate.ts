import { randomUUID } from "node:crypto";
import { AdsApiError } from "./amazon";
import type {
  AdsAction,
  Campaign,
  Keyword,
  NegativeEntry,
  ProductAd,
  ProductTarget,
} from "./types";

export function applySimulated(campaigns: Campaign[], action: AdsAction): {
  summary: string;
  before: unknown;
  after: unknown;
} {
  if (action.type === "apply_search_term") {
    return applySimulated(campaigns, expandSearchTerm(action));
  }

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
      kitId: action.kitId,
      adGroupId: `sim-ag-${campaignId}`,
      keywords: [],
      negatives: [],
      productTargets: [],
      productAds: [],
    };
    campaigns.push(created);
    return {
      summary: `API not connected. Sample only: created “${action.name}” (${action.state}) at $${action.dailyBudget.toFixed(2)}/day. No Amazon call was made.`,
      before: null,
      after: publicCampaign(created),
    };
  }

  if (action.type === "set_budget") {
    const campaign = requireCampaign(campaigns, action.campaignId);
    const before = publicCampaign(campaign);
    campaign.dailyBudget = action.dailyBudget;
    return {
      summary: `API not connected. Sample only: set ${campaign.name} daily budget from $${before.dailyBudget.toFixed(2)} to $${campaign.dailyBudget.toFixed(2)}. No Amazon call was made.`,
      before,
      after: publicCampaign(campaign),
    };
  }

  if (action.type === "set_campaign_state") {
    const before = action.campaignIds.map((id) => publicCampaign(requireCampaign(campaigns, id)));
    for (const id of action.campaignIds) requireCampaign(campaigns, id).state = action.state;
    const after = action.campaignIds.map((id) => publicCampaign(requireCampaign(campaigns, id)));
    return {
      summary: `API not connected. Sample only: set ${action.campaignIds.length} campaign(s) to ${action.state}. Nothing was archived or deleted.`,
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
      summary: `API not connected. Sample only: updated ${campaign.name}. No Amazon call was made.`,
      before,
      after: publicCampaign(campaign),
    };
  }

  if (action.type === "update_keyword") {
    const campaign = requireCampaign(campaigns, action.campaignId);
    const keyword = campaign.keywords.find((item) => item.keywordId === action.keywordId);
    if (!keyword) throw new AdsApiError(`No keyword ${action.keywordId} is in this sample view.`, 404);
    const before = publicKeyword(keyword);
    if (action.bid != null) keyword.bid = action.bid;
    if (action.state) keyword.state = action.state;
    return {
      summary: `API not connected. Sample only: updated keyword “${keyword.keywordText}” on ${campaign.name}. No Amazon call was made.`,
      before,
      after: publicKeyword(keyword),
    };
  }

  if (action.type === "add_keyword") {
    const campaign = requireCampaign(campaigns, action.campaignId);
    const before = campaign.keywords.map(publicKeyword);
    const existing = campaign.keywords.find(
      (keyword) =>
        keyword.keywordText.toLowerCase() === action.keywordText.toLowerCase() &&
        keyword.matchType === action.matchType &&
        !keyword.negative,
    );
    if (existing) {
      existing.bid = action.bid;
      existing.state = action.state;
    } else {
      campaign.keywords.push({
        keywordId: `sim-kw-${randomUUID().slice(0, 8)}`,
        campaignId: campaign.campaignId,
        adGroupId: action.adGroupId || campaign.adGroupId,
        keywordText: action.keywordText,
        matchType: action.matchType,
        bid: action.bid,
        state: action.state,
        negative: false,
      });
    }
    return {
      summary: `API not connected. Sample only: added ${action.matchType} keyword “${action.keywordText}” on ${campaign.name} at $${action.bid.toFixed(2)}. No Amazon call was made.`,
      before,
      after: campaign.keywords.map(publicKeyword),
    };
  }

  if (action.type === "add_negative") {
    const campaign = requireCampaign(campaigns, action.campaignId);
    const before = campaign.negatives.map(publicNegative);
    const value = action.kind === "ASIN" ? (action.asin || "").toUpperCase() : action.keywordText || "";
    const matchType = action.kind === "ASIN" ? "ASIN_SAME_AS" : action.matchType || "NEGATIVE_EXACT";
    const existing = campaign.negatives.find(
      (entry) => entry.kind === action.kind && entry.value.toLowerCase() === value.toLowerCase() && entry.scope === action.scope,
    );
    if (existing) existing.state = action.state;
    else {
      campaign.negatives.push({
        entryId: `sim-neg-${randomUUID().slice(0, 8)}`,
        campaignId: campaign.campaignId,
        adGroupId: action.scope === "AD_GROUP" ? action.adGroupId || campaign.adGroupId : "",
        scope: action.scope,
        kind: action.kind,
        value,
        matchType,
        state: action.state,
      });
    }
    return {
      summary: `API not connected. Sample only: added negative ${action.kind.toLowerCase()} “${value}” on ${campaign.name} (${action.scope}). No Amazon call was made.`,
      before,
      after: campaign.negatives.map(publicNegative),
    };
  }

  if (action.type === "upsert_product_target") {
    const campaign = requireCampaign(campaigns, action.campaignId);
    const before = campaign.productTargets.map(publicTarget);
    const existing = campaign.productTargets.find(
      (target) => target.targetId === action.targetId || target.asin === action.asin,
    );
    if (existing) {
      existing.state = action.state;
      if (action.bid != null) existing.bid = action.bid;
      existing.asin = action.asin;
    } else {
      campaign.productTargets.push({
        targetId: `sim-tgt-${randomUUID().slice(0, 8)}`,
        campaignId: campaign.campaignId,
        adGroupId: action.adGroupId || campaign.adGroupId,
        asin: action.asin,
        bid: action.bid ?? 0,
        state: action.state,
      });
    }
    return {
      summary: `API not connected. Sample only: product target ${action.asin} on ${campaign.name} is ${action.state}. No Amazon call was made.`,
      before,
      after: campaign.productTargets.map(publicTarget),
    };
  }

  if (action.type === "manage_product_ad") {
    const campaign = requireCampaign(campaigns, action.campaignId);
    const before = campaign.productAds.map(publicAd);
    const existing = campaign.productAds.find(
      (ad) => ad.adId === action.adId || (action.asin && ad.asin === action.asin) || (action.sku && ad.sku === action.sku),
    );
    if (existing) existing.state = action.state;
    else {
      campaign.productAds.push({
        adId: `sim-ad-${randomUUID().slice(0, 8)}`,
        campaignId: campaign.campaignId,
        adGroupId: action.adGroupId || campaign.adGroupId,
        asin: action.asin || "",
        sku: action.sku || "",
        state: action.state,
      });
    }
    return {
      summary: `API not connected. Sample only: product ad ${action.asin || action.sku || action.adId} on ${campaign.name} is ${action.state}. No Amazon call was made.`,
      before,
      after: campaign.productAds.map(publicAd),
    };
  }

  const campaign = requireCampaign(campaigns, action.campaignId);
  const before = campaign.keywords.map(publicKeyword);
  for (const input of action.keywords) {
    if (input.negative) {
      const value = input.keywordText;
      const matchType = input.matchType === "BROAD" ? "NEGATIVE_BROAD" : input.matchType === "PHRASE" ? "NEGATIVE_PHRASE" : "NEGATIVE_EXACT";
      const existingNegative = campaign.negatives.find(
        (entry) => entry.kind === "KEYWORD" && entry.value.toLowerCase() === value.toLowerCase(),
      );
      if (existingNegative) existingNegative.state = input.state;
      else {
        campaign.negatives.push({
          entryId: `sim-neg-${randomUUID().slice(0, 8)}`,
          campaignId: campaign.campaignId,
          adGroupId: campaign.adGroupId,
          scope: "AD_GROUP",
          kind: "KEYWORD",
          value,
          matchType,
          state: input.state,
        });
      }
      continue;
    }
    const existing = campaign.keywords.find(
      (keyword) =>
        keyword.keywordId === input.keywordId ||
        (keyword.keywordText.toLowerCase() === input.keywordText.toLowerCase() &&
          keyword.matchType === input.matchType &&
          !keyword.negative),
    );
    if (existing) {
      existing.bid = input.bid;
      existing.state = input.state;
      existing.keywordText = input.keywordText;
      existing.matchType = input.matchType;
      existing.negative = false;
    } else {
      campaign.keywords.push({
        keywordId: `sim-kw-${randomUUID().slice(0, 8)}`,
        campaignId: campaign.campaignId,
        adGroupId: campaign.adGroupId,
        keywordText: input.keywordText,
        matchType: input.matchType,
        bid: input.bid,
        state: input.state,
        negative: false,
      });
    }
  }
  return {
    summary: `API not connected. Sample only: updated ${action.keywords.length} keyword(s) on ${campaign.name}. No Amazon call was made.`,
    before,
    after: campaign.keywords.map(publicKeyword),
  };
}

function expandSearchTerm(action: Extract<AdsAction, { type: "apply_search_term" }>): AdsAction {
  if (action.as === "KEYWORD") {
    return {
      type: "add_keyword",
      campaignId: action.campaignId,
      adGroupId: action.adGroupId,
      keywordText: action.searchTerm,
      matchType: action.matchType === "PHRASE" || action.matchType === "BROAD" ? action.matchType : "EXACT",
      bid: action.bid ?? 0,
      state: action.state,
    };
  }
  if (action.as === "NEGATIVE_ASIN") {
    return {
      type: "add_negative",
      campaignId: action.campaignId,
      adGroupId: action.adGroupId,
      scope: action.scope ?? "AD_GROUP",
      kind: "ASIN",
      asin: action.searchTerm.toUpperCase(),
      state: action.state,
    };
  }
  return {
    type: "add_negative",
    campaignId: action.campaignId,
    adGroupId: action.adGroupId,
    scope: action.scope ?? "AD_GROUP",
    kind: "KEYWORD",
    keywordText: action.searchTerm,
    matchType:
      action.matchType === "NEGATIVE_PHRASE" || action.matchType === "NEGATIVE_BROAD" || action.matchType === "NEGATIVE_EXACT"
        ? action.matchType
        : action.matchType === "PHRASE"
          ? "NEGATIVE_PHRASE"
          : action.matchType === "BROAD"
            ? "NEGATIVE_BROAD"
            : "NEGATIVE_EXACT",
    state: action.state,
  };
}

function requireCampaign(campaigns: Campaign[], id: string): Campaign {
  const campaign = campaigns.find((item) => item.campaignId === id);
  if (!campaign) throw new AdsApiError(`No campaign ${id} is in this sample view.`, 404);
  return campaign;
}

function publicCampaign(campaign: Campaign) {
  return {
    campaignId: campaign.campaignId,
    name: campaign.name,
    state: campaign.state,
    dailyBudget: campaign.dailyBudget,
    targetingType: campaign.targetingType,
    sample: campaign.simulated,
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

function publicNegative(entry: NegativeEntry) {
  return {
    entryId: entry.entryId,
    kind: entry.kind,
    value: entry.value,
    matchType: entry.matchType,
    scope: entry.scope,
    state: entry.state,
  };
}

function publicTarget(target: ProductTarget) {
  return { targetId: target.targetId, asin: target.asin, bid: target.bid, state: target.state };
}

function publicAd(ad: ProductAd) {
  return { adId: ad.adId, asin: ad.asin, sku: ad.sku, state: ad.state };
}
