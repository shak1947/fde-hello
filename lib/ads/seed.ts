import type { Campaign, Keyword, SearchTerm } from "./types";

function keyword(
  partial: Pick<Keyword, "keywordId" | "campaignId" | "keywordText" | "matchType" | "bid" | "state"> &
    Partial<Keyword>,
): Keyword {
  return {
    adGroupId: partial.adGroupId ?? `sim-ag-${partial.campaignId}`,
    negative: partial.negative ?? false,
    ...partial,
  };
}

export function seedCampaigns(): Campaign[] {
  return [
    {
      campaignId: "sim-cmp-brand",
      name: "SOT Brand Defense",
      state: "ENABLED",
      targetingType: "MANUAL",
      dailyBudget: 35,
      spend: 128.4,
      sales: 540.1,
      clicks: 86,
      impressions: 12400,
      simulated: true,
      adGroupId: "sim-ag-sim-cmp-brand",
      keywords: [
        keyword({
          keywordId: "sim-kw-brand-1",
          campaignId: "sim-cmp-brand",
          keywordText: "sensationally ot",
          matchType: "EXACT",
          bid: 1.4,
          state: "ENABLED",
        }),
        keyword({
          keywordId: "sim-kw-brand-2",
          campaignId: "sim-cmp-brand",
          keywordText: "sensory chew",
          matchType: "PHRASE",
          bid: 0.95,
          state: "ENABLED",
        }),
      ],
      negatives: [
        {
          entryId: "sim-neg-brand-kw",
          campaignId: "sim-cmp-brand",
          adGroupId: "",
          scope: "CAMPAIGN",
          kind: "KEYWORD",
          value: "free",
          matchType: "NEGATIVE_EXACT",
          state: "ENABLED",
        },
        {
          entryId: "sim-neg-brand-asin",
          campaignId: "sim-cmp-brand",
          adGroupId: "sim-ag-sim-cmp-brand",
          scope: "AD_GROUP",
          kind: "ASIN",
          value: "B0SAMPLE01",
          matchType: "ASIN_SAME_AS",
          state: "ENABLED",
        },
      ],
      productTargets: [
        {
          targetId: "sim-tgt-brand-1",
          campaignId: "sim-cmp-brand",
          adGroupId: "sim-ag-sim-cmp-brand",
          asin: "B0SAMPLE02",
          bid: 0.85,
          state: "ENABLED",
        },
      ],
      productAds: [
        {
          adId: "sim-ad-brand-1",
          campaignId: "sim-cmp-brand",
          adGroupId: "sim-ag-sim-cmp-brand",
          asin: "B0SAMPLE03",
          sku: "SOT-SAMPLE",
          state: "ENABLED",
        },
      ],
    },
    {
      campaignId: "sim-cmp-chews",
      name: "SOT Sensory Chews",
      state: "PAUSED",
      targetingType: "MANUAL",
      dailyBudget: 20,
      spend: 64.2,
      sales: 110.5,
      clicks: 41,
      impressions: 5300,
      simulated: true,
      adGroupId: "sim-ag-sim-cmp-chews",
      keywords: [
        keyword({
          keywordId: "sim-kw-chew-1",
          campaignId: "sim-cmp-chews",
          keywordText: "chew necklace sensory",
          matchType: "EXACT",
          bid: 1.1,
          state: "PAUSED",
        }),
      ],
      negatives: [],
      productTargets: [],
      productAds: [],
    },
    {
      campaignId: "sim-cmp-auto",
      name: "SOT Auto Discovery",
      state: "ENABLED",
      targetingType: "AUTO",
      dailyBudget: 15,
      spend: 42.15,
      sales: 90,
      clicks: 40,
      impressions: 8000,
      simulated: true,
      adGroupId: "sim-ag-sim-cmp-auto",
      keywords: [],
      negatives: [],
      productTargets: [],
      productAds: [],
    },
  ];
}

export function seedSearchTerms(): SearchTerm[] {
  return [
    {
      searchTerm: "sensory chew necklace",
      campaignId: "sim-cmp-brand",
      campaignName: "SOT Brand Defense",
      adGroupId: "sim-ag-sim-cmp-brand",
      impressions: 420,
      clicks: 18,
      cost: 14.2,
      sales: 79.9,
      orders: 2,
      sample: true,
    },
    {
      searchTerm: "B0SAMPLE01",
      campaignId: "sim-cmp-chews",
      campaignName: "SOT Sensory Chews",
      adGroupId: "sim-ag-sim-cmp-chews",
      impressions: 80,
      clicks: 4,
      cost: 3.1,
      sales: 0,
      orders: 0,
      sample: true,
    },
  ];
}
