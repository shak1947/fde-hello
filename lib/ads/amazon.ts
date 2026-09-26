import { attachKits } from "./catalog";
import { readCap } from "./caps";
import { amazonEnv, type AmazonEnv } from "./mode";
import { redactSecrets } from "./redact";
import type {
  AdsAction,
  Campaign,
  DeliveryState,
  Keyword,
  MatchType,
  NegativeEntry,
  NegativeMatchType,
  ProductAd,
  ProductTarget,
} from "./types";

export const ALLOWED_AMAZON_PATHS = [
  "/sp/campaigns/list",
  "/sp/campaigns",
  "/sp/adGroups/list",
  "/sp/adGroups",
  "/sp/keywords/list",
  "/sp/keywords",
  "/sp/negativeKeywords/list",
  "/sp/negativeKeywords",
  "/sp/campaignNegativeKeywords/list",
  "/sp/campaignNegativeKeywords",
  "/sp/targets/list",
  "/sp/targets",
  "/sp/negativeTargets/list",
  "/sp/negativeTargets",
  "/sp/campaignNegativeTargets/list",
  "/sp/campaignNegativeTargets",
  "/sp/productAds/list",
  "/sp/productAds",
  "/reporting/reports",
] as const;

const STATIC_PATHS = new Set<string>(ALLOWED_AMAZON_PATHS);

const MEDIA = {
  campaign: "application/vnd.spCampaign.v3+json",
  adGroup: "application/vnd.spAdGroup.v3+json",
  keyword: "application/vnd.spKeyword.v3+json",
  negativeKeyword: "application/vnd.spNegativeKeyword.v3+json",
  campaignNegativeKeyword: "application/vnd.spCampaignNegativeKeyword.v3+json",
  target: "application/vnd.spTargetingClause.v3+json",
  negativeTarget: "application/vnd.spNegativeTargetingClause.v3+json",
  campaignNegativeTarget: "application/vnd.spCampaignNegativeTargetingClause.v3+json",
  productAd: "application/vnd.spProductAd.v3+json",
  report: "application/vnd.createasyncreportrequest.v3+json",
} as const;

export type AmazonCall = {
  method: "GET" | "POST" | "PUT";
  path: string;
  body?: unknown;
  media: string;
};

export class AdsApiError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export function assertSafeCall(call: AmazonCall) {
  if (call.method !== "GET" && call.method !== "POST" && call.method !== "PUT") {
    throw new AdsApiError("Blocked an Amazon Ads method outside the allowlist.", 403);
  }
  if (!isAllowedPath(call.path)) {
    throw new AdsApiError("Blocked an Amazon Ads request outside the allowlist.", 403);
  }
}

function isAllowedPath(path: string): boolean {
  if (!path.startsWith("/") || path.includes("?") || path.includes("..") || path.includes("\\")) return false;
  if (/delete|billing|invoice|payment|credential|password|email|gmail/i.test(path)) return false;
  if (path.startsWith("/sb") || path.startsWith("/sd")) return false;
  if (STATIC_PATHS.has(path)) return true;
  return /^\/reporting\/reports\/[A-Za-z0-9_-]{8,80}$/.test(path);
}

type TokenCache = { accessToken: string; expiresAt: number };
const tokens = new Map<string, TokenCache>();

export function clearTokenCache() {
  tokens.clear();
}

async function accessToken(env: AmazonEnv, fetchImpl: typeof fetch): Promise<string> {
  const cached = tokens.get(env.profileId);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.accessToken;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: env.clientId,
    client_secret: env.clientSecret,
    refresh_token: env.refreshToken,
  });
  const response = await fetchImpl(env.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!response.ok || !payload.access_token) {
    throw new AdsApiError("Amazon Ads login failed. Credentials stay on the server.", 502);
  }
  tokens.set(env.profileId, {
    accessToken: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  });
  return payload.access_token;
}

export async function amazonFetch(
  call: AmazonCall,
  deps?: { env?: AmazonEnv; fetchImpl?: typeof fetch },
): Promise<unknown> {
  assertSafeCall(call);
  const env = deps?.env ?? amazonEnv();
  const fetchImpl = deps?.fetchImpl ?? fetch;
  const token = await accessToken(env, fetchImpl);
  const response = await fetchImpl(`${env.apiBase}${call.path}`, {
    method: call.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Amazon-Advertising-API-ClientId": env.clientId,
      "Amazon-Advertising-API-Scope": env.profileId,
      Accept: call.media,
      ...(call.body ? { "Content-Type": call.media } : {}),
    },
    body: call.body ? JSON.stringify(call.body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  const payload = text ? safeJson(text) : {};
  if (!response.ok) {
    throw new AdsApiError(publicAmazonError(payload, response.status), response.status);
  }
  return payload;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: "Amazon Ads returned a non-JSON body." };
  }
}

function publicAmazonError(payload: unknown, status: number): string {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const code = typeof record.code === "string" && /^[A-Z0-9_]{1,40}$/.test(record.code) ? ` (${record.code})` : "";
  return redactSecrets(`Amazon Ads returned ${status}${code}. Credentials stay on the server.`);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function stateOf(value: unknown): DeliveryState {
  return value === "PAUSED" ? "PAUSED" : "ENABLED";
}

function matchOf(value: unknown): MatchType {
  if (value === "PHRASE" || value === "BROAD" || value === "EXACT") return value;
  return "EXACT";
}

function negativeMatchOf(value: unknown): NegativeMatchType {
  if (value === "NEGATIVE_PHRASE" || value === "NEGATIVE_BROAD" || value === "NEGATIVE_EXACT") return value;
  return "NEGATIVE_EXACT";
}

function defaultAdGroupBid(): number {
  const cap = readCap("ADS_MAX_BID");
  if (cap.kind === "set") return Math.min(1, cap.value);
  return 1;
}

export function mapCampaigns(payload: unknown, keywords: Keyword[] = []): Campaign[] {
  const rows = asArray(asRecord(payload).campaigns);
  return rows
    .filter((row) => row.state !== "ARCHIVED")
    .map((row) => {
      const campaignId = String(row.campaignId ?? "");
      const budget = asRecord(row.budget);
      const ownKeywords = keywords.filter((keyword) => keyword.campaignId === campaignId);
      return {
        campaignId,
        name: String(row.name ?? "Campaign"),
        state: stateOf(row.state),
        targetingType: row.targetingType === "AUTO" ? "AUTO" : "MANUAL",
        dailyBudget: Number(budget.budget ?? 0),
        spend: null,
        sales: null,
        clicks: null,
        impressions: null,
        simulated: false,
        adGroupId: ownKeywords[0]?.adGroupId ?? "",
        keywords: ownKeywords,
        negatives: [],
        productTargets: [],
        productAds: [],
      } satisfies Campaign;
    });
}

export function mapKeywords(payload: unknown): Keyword[] {
  const rows = asArray(asRecord(payload).keywords);
  return rows
    .filter((row) => row.state !== "ARCHIVED")
    .map((row) => ({
      keywordId: String(row.keywordId ?? ""),
      campaignId: String(row.campaignId ?? ""),
      adGroupId: String(row.adGroupId ?? ""),
      keywordText: String(row.keywordText ?? ""),
      matchType: matchOf(row.matchType),
      bid: Number(row.bid ?? 0),
      state: stateOf(row.state),
      negative: false,
    }));
}

function mapKeywordNegatives(payload: unknown, scope: "CAMPAIGN" | "AD_GROUP"): NegativeEntry[] {
  const key = scope === "CAMPAIGN" ? "campaignNegativeKeywords" : "negativeKeywords";
  return asArray(asRecord(payload)[key])
    .filter((row) => row.state !== "ARCHIVED")
    .map((row) => ({
      entryId: String(row.keywordId ?? ""),
      campaignId: String(row.campaignId ?? ""),
      adGroupId: String(row.adGroupId ?? ""),
      scope,
      kind: "KEYWORD" as const,
      value: String(row.keywordText ?? ""),
      matchType: negativeMatchOf(row.matchType),
      state: stateOf(row.state),
    }));
}

function expressionValue(row: Record<string, unknown>): string {
  const expression = Array.isArray(row.expression) ? asRecord(row.expression[0]) : asRecord(row.expression);
  return String(expression.value ?? "").toUpperCase();
}

function mapAsinNegatives(payload: unknown, scope: "CAMPAIGN" | "AD_GROUP"): NegativeEntry[] {
  const key = scope === "CAMPAIGN" ? "campaignNegativeTargetingClauses" : "negativeTargetingClauses";
  return asArray(asRecord(payload)[key])
    .filter((row) => row.state !== "ARCHIVED")
    .map((row) => ({
      entryId: String(row.targetId ?? ""),
      campaignId: String(row.campaignId ?? ""),
      adGroupId: String(row.adGroupId ?? ""),
      scope,
      kind: "ASIN" as const,
      value: expressionValue(row),
      matchType: "ASIN_SAME_AS" as const,
      state: stateOf(row.state),
    }));
}

function mapTargets(payload: unknown): ProductTarget[] {
  return asArray(asRecord(payload).targetingClauses)
    .filter((row) => row.state !== "ARCHIVED")
    .map((row) => ({
      targetId: String(row.targetId ?? ""),
      campaignId: String(row.campaignId ?? ""),
      adGroupId: String(row.adGroupId ?? ""),
      asin: expressionValue(row),
      bid: Number(row.bid ?? 0),
      state: stateOf(row.state),
    }));
}

function mapProductAds(payload: unknown): ProductAd[] {
  return asArray(asRecord(payload).productAds)
    .filter((row) => row.state !== "ARCHIVED")
    .map((row) => ({
      adId: String(row.adId ?? ""),
      campaignId: String(row.campaignId ?? ""),
      adGroupId: String(row.adGroupId ?? ""),
      asin: String(row.asin ?? "").toUpperCase(),
      sku: String(row.sku ?? ""),
      state: stateOf(row.state),
    }));
}

const ACTIVE = { maxResults: 100, stateFilter: { include: ["ENABLED", "PAUSED"] } };

async function tryList(call: AmazonCall, deps?: { env?: AmazonEnv; fetchImpl?: typeof fetch }): Promise<unknown> {
  try {
    return await amazonFetch(call, deps);
  } catch (error) {
    if (error instanceof AdsApiError && call.path === "/sp/campaigns/list") throw error;
    return {};
  }
}

export async function amazonListCampaigns(deps?: {
  env?: AmazonEnv;
  fetchImpl?: typeof fetch;
}): Promise<Campaign[]> {
  const campaignPayload = await amazonFetch(
    { method: "POST", path: "/sp/campaigns/list", media: MEDIA.campaign, body: ACTIVE },
    deps,
  );
  const [keywordPayload, adGroupPayload, negativePayload, campaignNegativePayload, targetPayload, negativeTargetPayload, campaignNegativeTargetPayload, productAdPayload] =
    await Promise.all([
      tryList({ method: "POST", path: "/sp/keywords/list", media: MEDIA.keyword, body: { ...ACTIVE, maxResults: 200 } }, deps),
      tryList({ method: "POST", path: "/sp/adGroups/list", media: MEDIA.adGroup, body: ACTIVE }, deps),
      tryList({ method: "POST", path: "/sp/negativeKeywords/list", media: MEDIA.negativeKeyword, body: ACTIVE }, deps),
      tryList(
        { method: "POST", path: "/sp/campaignNegativeKeywords/list", media: MEDIA.campaignNegativeKeyword, body: ACTIVE },
        deps,
      ),
      tryList({ method: "POST", path: "/sp/targets/list", media: MEDIA.target, body: ACTIVE }, deps),
      tryList({ method: "POST", path: "/sp/negativeTargets/list", media: MEDIA.negativeTarget, body: ACTIVE }, deps),
      tryList(
        { method: "POST", path: "/sp/campaignNegativeTargets/list", media: MEDIA.campaignNegativeTarget, body: ACTIVE },
        deps,
      ),
      tryList({ method: "POST", path: "/sp/productAds/list", media: MEDIA.productAd, body: ACTIVE }, deps),
    ]);

  const keywords = mapKeywords(keywordPayload);
  const campaigns = mapCampaigns(campaignPayload, keywords);
  const groups = asArray(asRecord(adGroupPayload).adGroups);
  const negatives = [
    ...mapKeywordNegatives(negativePayload, "AD_GROUP"),
    ...mapKeywordNegatives(campaignNegativePayload, "CAMPAIGN"),
    ...mapAsinNegatives(negativeTargetPayload, "AD_GROUP"),
    ...mapAsinNegatives(campaignNegativeTargetPayload, "CAMPAIGN"),
  ];
  const targets = mapTargets(targetPayload);
  const productAds = mapProductAds(productAdPayload);
  for (const campaign of campaigns) {
    if (!campaign.adGroupId) {
      const group = groups.find((row) => String(row.campaignId) === campaign.campaignId && row.state !== "ARCHIVED");
      if (group) campaign.adGroupId = String(group.adGroupId ?? "");
    }
    campaign.negatives = negatives.filter((entry) => entry.campaignId === campaign.campaignId);
    campaign.productTargets = targets.filter((entry) => entry.campaignId === campaign.campaignId);
    campaign.productAds = productAds.filter((entry) => entry.campaignId === campaign.campaignId);
  }
  return attachKits(campaigns);
}

function mutationError(payload: unknown, key: string): string | null {
  const bucket = asRecord(asRecord(payload)[key]);
  const errors = asArray(bucket.error);
  if (!errors.length) return null;
  const first = errors[0];
  const nested = asArray(first.errors)[0];
  const raw = String(nested?.errorType || first.errorType || "Amazon Ads rejected the change.");
  const safe = /^[A-Za-z0-9_ .:-]{1,80}$/.test(raw) ? raw : "Amazon Ads rejected the change.";
  return redactSecrets(safe);
}

function assertMutation(payload: unknown, key: string) {
  const failure = mutationError(payload, key);
  if (failure) throw new AdsApiError(failure, 422);
}

async function ensureAdGroup(
  campaignId: string,
  deps: { env?: AmazonEnv; fetchImpl?: typeof fetch } | undefined,
  preferred?: string,
): Promise<string> {
  if (preferred?.trim()) return preferred.trim();
  const listed = await amazonFetch(
    {
      method: "POST",
      path: "/sp/adGroups/list",
      media: MEDIA.adGroup,
      body: { campaignIdFilter: { include: [campaignId] }, maxResults: 10, stateFilter: { include: ["ENABLED", "PAUSED"] } },
    },
    deps,
  );
  let adGroupId = String(asArray(asRecord(listed).adGroups)[0]?.adGroupId ?? "");
  if (!adGroupId) {
    const created = await amazonFetch(
      {
        method: "POST",
        path: "/sp/adGroups",
        media: MEDIA.adGroup,
        body: {
          adGroups: [
            {
              campaignId,
              name: "Default",
              state: "ENABLED",
              defaultBid: defaultAdGroupBid(),
            },
          ],
        },
      },
      deps,
    );
    assertMutation(created, "adGroups");
    adGroupId = String(asArray(asRecord(asRecord(created).adGroups).success)[0]?.adGroupId ?? "");
  }
  if (!adGroupId) throw new AdsApiError("Amazon Ads did not return an ad group for that campaign.", 422);
  return adGroupId;
}

export async function amazonApply(
  action: AdsAction,
  deps?: { env?: AmazonEnv; fetchImpl?: typeof fetch },
): Promise<{ summary: string; before: unknown; after: unknown }> {
  if (action.type === "apply_search_term") return amazonApply(expandSearchTerm(action), deps);

  if (action.type === "create_campaign") {
    const created = await amazonFetch(
      {
        method: "POST",
        path: "/sp/campaigns",
        media: MEDIA.campaign,
        body: {
          campaigns: [
            {
              name: action.name,
              targetingType: action.targetingType,
              state: action.state,
              budget: { budgetType: "DAILY", budget: action.dailyBudget },
              startDate: new Date().toISOString().slice(0, 10),
              dynamicBidding: { strategy: "LEGACY_FOR_SALES" },
            },
          ],
        },
      },
      deps,
    );
    assertMutation(created, "campaigns");
    const success = asArray(asRecord(asRecord(created).campaigns).success)[0];
    const campaignId = String(success?.campaignId ?? "");
    if (campaignId) await ensureAdGroup(campaignId, deps);
    return {
      summary: `Created “${action.name}” at $${action.dailyBudget.toFixed(2)}/day (${action.state}).`,
      before: null,
      after: { campaignId, name: action.name, state: action.state, dailyBudget: action.dailyBudget },
    };
  }

  if (action.type === "set_budget") {
    const payload = await amazonFetch(
      {
        method: "PUT",
        path: "/sp/campaigns",
        media: MEDIA.campaign,
        body: {
          campaigns: [{ campaignId: action.campaignId, budget: { budgetType: "DAILY", budget: action.dailyBudget } }],
        },
      },
      deps,
    );
    assertMutation(payload, "campaigns");
    return {
      summary: `Set daily budget on ${action.campaignId} to $${action.dailyBudget.toFixed(2)}.`,
      before: null,
      after: { campaignId: action.campaignId, dailyBudget: action.dailyBudget },
    };
  }

  if (action.type === "set_campaign_state" || action.type === "update_campaign") {
    const ids = action.type === "update_campaign" ? [action.campaignId] : action.campaignIds;
    const state = action.state;
    const name = action.type === "update_campaign" ? action.name : undefined;
    const payload = await amazonFetch(
      {
        method: "PUT",
        path: "/sp/campaigns",
        media: MEDIA.campaign,
        body: {
          campaigns: ids.map((campaignId) => ({
            campaignId,
            ...(state ? { state } : {}),
            ...(name ? { name } : {}),
          })),
        },
      },
      deps,
    );
    assertMutation(payload, "campaigns");
    return {
      summary:
        action.type === "update_campaign"
          ? `Updated campaign ${action.campaignId}.`
          : `Set ${ids.length} campaign(s) to ${state}.`,
      before: null,
      after: { campaignIds: ids, state: state ?? null },
    };
  }

  if (action.type === "update_keyword") {
    const payload = await amazonFetch(
      {
        method: "PUT",
        path: "/sp/keywords",
        media: MEDIA.keyword,
        body: {
          keywords: [
            {
              keywordId: action.keywordId,
              ...(action.state ? { state: action.state } : {}),
              ...(action.bid != null ? { bid: action.bid } : {}),
            },
          ],
        },
      },
      deps,
    );
    assertMutation(payload, "keywords");
    return {
      summary: `Updated keyword ${action.keywordId}.`,
      before: null,
      after: { keywordId: action.keywordId, bid: action.bid ?? null, state: action.state ?? null },
    };
  }

  if (action.type === "add_keyword") {
    const adGroupId = await ensureAdGroup(action.campaignId, deps, action.adGroupId);
    const payload = await amazonFetch(
      {
        method: "POST",
        path: "/sp/keywords",
        media: MEDIA.keyword,
        body: {
          keywords: [
            {
              campaignId: action.campaignId,
              adGroupId,
              keywordText: action.keywordText,
              matchType: action.matchType,
              state: action.state,
              bid: action.bid,
            },
          ],
        },
      },
      deps,
    );
    assertMutation(payload, "keywords");
    return {
      summary: `Added ${action.matchType} keyword “${action.keywordText}” at $${action.bid.toFixed(2)}.`,
      before: null,
      after: { campaignId: action.campaignId, adGroupId, keywordText: action.keywordText, matchType: action.matchType },
    };
  }

  if (action.type === "add_negative") {
    return applyNegative(action, deps);
  }

  if (action.type === "upsert_product_target") {
    return applyProductTarget(action, deps);
  }

  if (action.type === "manage_product_ad") {
    return applyProductAd(action, deps);
  }

  const adGroupId = await ensureAdGroup(action.campaignId, deps);
  const updates = action.keywords.filter((keyword) => keyword.keywordId && !keyword.negative);
  const creates = action.keywords.filter((keyword) => !keyword.keywordId && !keyword.negative);
  const negatives = action.keywords.filter((keyword) => keyword.negative);
  if (updates.length) {
    const payload = await amazonFetch(
      {
        method: "PUT",
        path: "/sp/keywords",
        media: MEDIA.keyword,
        body: {
          keywords: updates.map((keyword) => ({
            keywordId: keyword.keywordId,
            state: keyword.state,
            bid: keyword.bid,
          })),
        },
      },
      deps,
    );
    assertMutation(payload, "keywords");
  }
  if (creates.length) {
    const payload = await amazonFetch(
      {
        method: "POST",
        path: "/sp/keywords",
        media: MEDIA.keyword,
        body: {
          keywords: creates.map((keyword) => ({
            campaignId: action.campaignId,
            adGroupId,
            keywordText: keyword.keywordText,
            matchType: keyword.matchType,
            state: keyword.state,
            bid: keyword.bid,
          })),
        },
      },
      deps,
    );
    assertMutation(payload, "keywords");
  }
  for (const keyword of negatives) {
    await applyNegative(
      {
        type: "add_negative",
        campaignId: action.campaignId,
        adGroupId,
        scope: "AD_GROUP",
        kind: "KEYWORD",
        keywordText: keyword.keywordText,
        matchType: keyword.matchType === "BROAD" ? "NEGATIVE_BROAD" : keyword.matchType === "PHRASE" ? "NEGATIVE_PHRASE" : "NEGATIVE_EXACT",
        state: keyword.state,
      },
      deps,
    );
  }
  return {
    summary: `Updated ${action.keywords.length} keyword(s) on ${action.campaignId}.`,
    before: null,
    after: { campaignId: action.campaignId, count: action.keywords.length },
  };
}

async function applyNegative(
  action: Extract<AdsAction, { type: "add_negative" }>,
  deps?: { env?: AmazonEnv; fetchImpl?: typeof fetch },
): Promise<{ summary: string; before: unknown; after: unknown }> {
  if (action.kind === "ASIN") {
    const asin = (action.asin || "").toUpperCase();
    if (action.scope === "CAMPAIGN") {
      const payload = await amazonFetch(
        {
          method: "POST",
          path: "/sp/campaignNegativeTargets",
          media: MEDIA.campaignNegativeTarget,
          body: {
            campaignNegativeTargetingClauses: [
              {
                campaignId: action.campaignId,
                state: action.state,
                expression: [{ type: "ASIN_SAME_AS", value: asin }],
              },
            ],
          },
        },
        deps,
      );
      assertMutation(payload, "campaignNegativeTargetingClauses");
    } else {
      const adGroupId = await ensureAdGroup(action.campaignId, deps, action.adGroupId);
      const payload = await amazonFetch(
        {
          method: "POST",
          path: "/sp/negativeTargets",
          media: MEDIA.negativeTarget,
          body: {
            negativeTargetingClauses: [
              {
                campaignId: action.campaignId,
                adGroupId,
                state: action.state,
                expression: [{ type: "ASIN_SAME_AS", value: asin }],
              },
            ],
          },
        },
        deps,
      );
      assertMutation(payload, "negativeTargetingClauses");
    }
    return {
      summary: `Added negative ASIN ${asin} at ${action.scope === "CAMPAIGN" ? "campaign" : "ad group"} scope.`,
      before: null,
      after: { campaignId: action.campaignId, asin, scope: action.scope },
    };
  }

  const matchType = action.matchType ?? "NEGATIVE_EXACT";
  const keywordText = action.keywordText ?? "";
  if (action.scope === "CAMPAIGN") {
    const payload = await amazonFetch(
      {
        method: "POST",
        path: "/sp/campaignNegativeKeywords",
        media: MEDIA.campaignNegativeKeyword,
        body: {
          campaignNegativeKeywords: [
            { campaignId: action.campaignId, keywordText, matchType, state: action.state },
          ],
        },
      },
      deps,
    );
    assertMutation(payload, "campaignNegativeKeywords");
  } else {
    const adGroupId = await ensureAdGroup(action.campaignId, deps, action.adGroupId);
    const payload = await amazonFetch(
      {
        method: "POST",
        path: "/sp/negativeKeywords",
        media: MEDIA.negativeKeyword,
        body: {
          negativeKeywords: [
            { campaignId: action.campaignId, adGroupId, keywordText, matchType, state: action.state },
          ],
        },
      },
      deps,
    );
    assertMutation(payload, "negativeKeywords");
  }
  return {
    summary: `Added ${matchType} negative “${keywordText}” at ${action.scope === "CAMPAIGN" ? "campaign" : "ad group"} scope.`,
    before: null,
    after: { campaignId: action.campaignId, keywordText, matchType, scope: action.scope },
  };
}

async function applyProductTarget(
  action: Extract<AdsAction, { type: "upsert_product_target" }>,
  deps?: { env?: AmazonEnv; fetchImpl?: typeof fetch },
): Promise<{ summary: string; before: unknown; after: unknown }> {
  if (action.targetId) {
    const payload = await amazonFetch(
      {
        method: "PUT",
        path: "/sp/targets",
        media: MEDIA.target,
        body: {
          targetingClauses: [
            {
              targetId: action.targetId,
              state: action.state,
              ...(action.bid != null ? { bid: action.bid } : {}),
            },
          ],
        },
      },
      deps,
    );
    assertMutation(payload, "targetingClauses");
    return {
      summary: `Updated product target ${action.asin}.`,
      before: null,
      after: { targetId: action.targetId, asin: action.asin, state: action.state, bid: action.bid ?? null },
    };
  }
  const adGroupId = await ensureAdGroup(action.campaignId, deps, action.adGroupId);
  const payload = await amazonFetch(
    {
      method: "POST",
      path: "/sp/targets",
      media: MEDIA.target,
      body: {
        targetingClauses: [
          {
            campaignId: action.campaignId,
            adGroupId,
            expressionType: "MANUAL",
            state: action.state,
            bid: action.bid,
            expression: [{ type: "ASIN_SAME_AS", value: action.asin }],
          },
        ],
      },
    },
    deps,
  );
  assertMutation(payload, "targetingClauses");
  return {
    summary: `Added product target ${action.asin} at $${(action.bid ?? 0).toFixed(2)}.`,
    before: null,
    after: { campaignId: action.campaignId, adGroupId, asin: action.asin, bid: action.bid ?? null },
  };
}

async function applyProductAd(
  action: Extract<AdsAction, { type: "manage_product_ad" }>,
  deps?: { env?: AmazonEnv; fetchImpl?: typeof fetch },
): Promise<{ summary: string; before: unknown; after: unknown }> {
  if (action.adId) {
    const payload = await amazonFetch(
      {
        method: "PUT",
        path: "/sp/productAds",
        media: MEDIA.productAd,
        body: { productAds: [{ adId: action.adId, state: action.state }] },
      },
      deps,
    );
    assertMutation(payload, "productAds");
    return {
      summary: `Set product ad ${action.adId} to ${action.state}.`,
      before: null,
      after: { adId: action.adId, state: action.state },
    };
  }
  const adGroupId = await ensureAdGroup(action.campaignId, deps, action.adGroupId);
  const payload = await amazonFetch(
    {
      method: "POST",
      path: "/sp/productAds",
      media: MEDIA.productAd,
      body: {
        productAds: [
          {
            campaignId: action.campaignId,
            adGroupId,
            state: action.state,
            ...(action.asin ? { asin: action.asin } : {}),
            ...(action.sku ? { sku: action.sku } : {}),
          },
        ],
      },
    },
    deps,
  );
  assertMutation(payload, "productAds");
  return {
    summary: `Added product ad ${action.asin || action.sku} (${action.state}).`,
    before: null,
    after: { campaignId: action.campaignId, adGroupId, asin: action.asin ?? null, sku: action.sku ?? null, state: action.state },
  };
}

function expandSearchTerm(action: Extract<AdsAction, { type: "apply_search_term" }>): AdsAction {
  if (action.as === "KEYWORD") {
    const matchType: MatchType = action.matchType === "PHRASE" || action.matchType === "BROAD" ? action.matchType : "EXACT";
    return {
      type: "add_keyword",
      campaignId: action.campaignId,
      adGroupId: action.adGroupId,
      keywordText: action.searchTerm,
      matchType,
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
  const matchType: NegativeMatchType =
    action.matchType === "NEGATIVE_PHRASE" || action.matchType === "NEGATIVE_BROAD" || action.matchType === "NEGATIVE_EXACT"
      ? action.matchType
      : action.matchType === "PHRASE"
        ? "NEGATIVE_PHRASE"
        : action.matchType === "BROAD"
          ? "NEGATIVE_BROAD"
          : "NEGATIVE_EXACT";
  return {
    type: "add_negative",
    campaignId: action.campaignId,
    adGroupId: action.adGroupId,
    scope: action.scope ?? "AD_GROUP",
    kind: "KEYWORD",
    keywordText: action.searchTerm,
    matchType,
    state: action.state,
  };
}

export { MEDIA };
