import type { Campaign, DeliveryState } from "./types";

export type Kit = {
  kitId: string;
  name: string;
  sku: string;
  asin: string;
};

/** Sensationally OT listings already documented in /eval. Not a performance report. */
export const CATALOG: Kit[] = [
  { kitId: "mermaid", name: "Mermaid dough kit", sku: "KIT-MERMAID", asin: "B0CFT7YF1L" },
  { kitId: "farm", name: "Farm dough", sku: "35-ZREI-MJZW", asin: "B0GCTV28TN" },
];

export function findKit(kitId: string | undefined): Kit | null {
  if (!kitId) return null;
  return CATALOG.find((kit) => kit.kitId === kitId) ?? null;
}

export function resolveKit(campaign: Pick<Campaign, "kitId" | "productAds">): Kit | null {
  const direct = findKit(campaign.kitId);
  if (direct) return direct;
  for (const ad of campaign.productAds ?? []) {
    const asin = ad.asin.toUpperCase();
    const byAsin = CATALOG.find((kit) => kit.asin === asin);
    if (byAsin) return byAsin;
    const sku = ad.sku.trim().toLowerCase();
    const bySku = CATALOG.find((kit) => kit.sku.toLowerCase() === sku);
    if (bySku) return bySku;
  }
  return null;
}

export function attachKits(campaigns: Campaign[]): Campaign[] {
  for (const campaign of campaigns) {
    campaign.kitId = resolveKit(campaign)?.kitId;
  }
  return campaigns;
}

export type KitCampaign = {
  campaignId: string;
  name: string;
  state: DeliveryState;
  dailyBudget: number;
  spend: number | null;
  sales: number | null;
  acos: number | null;
  simulated: boolean;
};

export type KitRollup = {
  kitId: string | null;
  name: string;
  sku: string;
  asin: string;
  campaigns: KitCampaign[];
  enabled: number;
  paused: number;
  dailyBudget: number;
  spend: number | null;
  sales: number | null;
  acos: number | null;
};

export function acosOf(spend: number | null, sales: number | null): number | null {
  if (spend == null || sales == null || sales <= 0) return null;
  return Math.round((spend / sales) * 1000) / 10;
}

export function groupByKit(campaigns: Campaign[]): KitRollup[] {
  const buckets = new Map<string | null, Campaign[]>();
  for (const kit of CATALOG) buckets.set(kit.kitId, []);
  for (const campaign of campaigns) {
    const kit = resolveKit(campaign);
    const key = kit?.kitId ?? null;
    const list = buckets.get(key) ?? [];
    list.push(campaign);
    buckets.set(key, list);
  }
  const rollups: KitRollup[] = CATALOG.map((kit) => rollup(kit, buckets.get(kit.kitId) ?? []));
  const loose = buckets.get(null) ?? [];
  if (loose.length) {
    rollups.push(
      rollup(
        { kitId: "", name: "Not tied to a kit", sku: "", asin: "" },
        loose,
        null,
      ),
    );
  }
  return rollups;
}

function sumKnown(values: Array<number | null>): number | null {
  if (!values.length || values.some((value) => value == null)) return null;
  let sum = 0;
  for (const value of values) sum += value ?? 0;
  return sum;
}

function rollup(
  kit: { kitId: string; name: string; sku: string; asin: string },
  campaigns: Campaign[],
  kitId: string | null = kit.kitId || null,
): KitRollup {
  const spend = sumKnown(campaigns.map((campaign) => campaign.spend));
  const sales = sumKnown(campaigns.map((campaign) => campaign.sales));
  return {
    kitId,
    name: kit.name,
    sku: kit.sku,
    asin: kit.asin,
    campaigns: campaigns.map((campaign) => ({
      campaignId: campaign.campaignId,
      name: campaign.name,
      state: campaign.state,
      dailyBudget: campaign.dailyBudget,
      spend: campaign.spend,
      sales: campaign.sales,
      acos: acosOf(campaign.spend, campaign.sales),
      simulated: campaign.simulated,
    })),
    enabled: campaigns.filter((campaign) => campaign.state === "ENABLED").length,
    paused: campaigns.filter((campaign) => campaign.state === "PAUSED").length,
    dailyBudget: campaigns.reduce((sum, campaign) => sum + campaign.dailyBudget, 0),
    spend,
    sales,
    acos: acosOf(spend, sales),
  };
}

export function kitNeedles(campaigns: Campaign[], kitId: string | undefined, campaignIds: string[]): string[] {
  const rows = campaignIds
    .map((id) => campaigns.find((campaign) => campaign.campaignId === id))
    .filter((campaign): campaign is Campaign => Boolean(campaign));
  const kits = new Map<string, Kit>();
  const chosen = findKit(kitId);
  if (chosen) kits.set(chosen.kitId, chosen);
  for (const row of rows) {
    const kit = resolveKit(row);
    if (kit) kits.set(kit.kitId, kit);
  }
  return [
    ...rows.map((row) => row.name),
    ...[...kits.values()].flatMap((kit) => [kit.name, kit.sku, kit.asin, kit.kitId]),
  ];
}
