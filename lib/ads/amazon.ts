import { amazonEnv, type AmazonEnv } from "./mode";
import type { AdsAction, Campaign, DeliveryState, Keyword, MatchType } from "./types";

export const ALLOWED_AMAZON_PATHS = [
  "/sp/campaigns/list",
  "/sp/campaigns",
  "/sp/adGroups/list",
  "/sp/adGroups",
  "/sp/keywords/list",
  "/sp/keywords",
] as const;

const MEDIA = {
  campaign: "application/vnd.spCampaign.v3+json",
  adGroup: "application/vnd.spAdGroup.v3+json",
  keyword: "application/vnd.spKeyword.v3+json",
} as const;

export type AmazonCall = {
  method: "GET" | "POST" | "PUT";
  path: (typeof ALLOWED_AMAZON_PATHS)[number];
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
  if (!ALLOWED_AMAZON_PATHS.includes(call.path)) {
    throw new AdsApiError("Blocked an Amazon Ads request outside the allowlist.", 403);
  }
  if (call.method !== "GET" && call.method !== "POST" && call.method !== "PUT") {
    throw new AdsApiError("Blocked an Amazon Ads method outside the allowlist.", 403);
  }
}

type TokenCache = { accessToken: string; expiresAt: number };
const tokens = new Map<string, TokenCache>();

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
    error_description?: string;
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
    return { message: text.slice(0, 240) };
  }
}

function publicAmazonError(payload: unknown, status: number): string {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const code = typeof record.code === "string" && /^[A-Z0-9_]{1,40}$/.test(record.code) ? ` (${record.code})` : "";
  return `Amazon Ads returned ${status}${code}. Credentials stay on the server.`;
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

export async function amazonListCampaigns(deps?: {
  env?: AmazonEnv;
  fetchImpl?: typeof fetch;
}): Promise<Campaign[]> {
  const [campaignPayload, keywordPayload, adGroupPayload] = await Promise.all([
    amazonFetch(
      {
        method: "POST",
        path: "/sp/campaigns/list",
        media: MEDIA.campaign,
        body: { maxResults: 100, stateFilter: { include: ["ENABLED", "PAUSED"] } },
      },
      deps,
    ),
    amazonFetch(
      {
        method: "POST",
        path: "/sp/keywords/list",
        media: MEDIA.keyword,
        body: { maxResults: 200, stateFilter: { include: ["ENABLED", "PAUSED"] } },
      },
      deps,
    ),
    amazonFetch(
      {
        method: "POST",
        path: "/sp/adGroups/list",
        media: MEDIA.adGroup,
        body: { maxResults: 100, stateFilter: { include: ["ENABLED", "PAUSED"] } },
      },
      deps,
    ),
  ]);
  const keywords = mapKeywords(keywordPayload);
  const campaigns = mapCampaigns(campaignPayload, keywords);
  const groups = asArray(asRecord(adGroupPayload).adGroups);
  for (const campaign of campaigns) {
    if (campaign.adGroupId) continue;
    const group = groups.find((row) => String(row.campaignId) === campaign.campaignId);
    if (group) campaign.adGroupId = String(group.adGroupId ?? "");
  }
  return campaigns;
}

function mutationError(payload: unknown, key: string): string | null {
  const bucket = asRecord(asRecord(payload)[key]);
  const errors = asArray(bucket.error);
  if (!errors.length) return null;
  const first = errors[0];
  const nested = asArray(first.errors)[0];
  return String(nested?.errorValue || first.errorType || first.message || "Amazon Ads rejected the change.");
}

export async function amazonApply(
  action: AdsAction,
  deps?: { env?: AmazonEnv; fetchImpl?: typeof fetch },
): Promise<{ summary: string; before: unknown; after: unknown }> {
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
    const failure = mutationError(created, "campaigns");
    if (failure) throw new AdsApiError(failure, 422);
    const success = asArray(asRecord(asRecord(created).campaigns).success)[0];
    const campaignId = String(success?.campaignId ?? "");
    if (campaignId) {
      await amazonFetch(
        {
          method: "POST",
          path: "/sp/adGroups",
          media: MEDIA.adGroup,
          body: {
            adGroups: [
              {
                campaignId,
                name: "Default",
                state: action.state,
                defaultBid: 1,
              },
            ],
          },
        },
        deps,
      );
    }
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
          campaigns: [
            {
              campaignId: action.campaignId,
              budget: { budgetType: "DAILY", budget: action.dailyBudget },
            },
          ],
        },
      },
      deps,
    );
    const failure = mutationError(payload, "campaigns");
    if (failure) throw new AdsApiError(failure, 422);
    return {
      summary: `Set daily budget on ${action.campaignId} to $${action.dailyBudget.toFixed(2)}.`,
      before: null,
      after: payload,
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
    const failure = mutationError(payload, "campaigns");
    if (failure) throw new AdsApiError(failure, 422);
    return {
      summary:
        action.type === "update_campaign"
          ? `Updated campaign ${action.campaignId}.`
          : `Set ${ids.length} campaign(s) to ${state}.`,
      before: null,
      after: payload,
    };
  }

  const listed = await amazonFetch(
    {
      method: "POST",
      path: "/sp/adGroups/list",
      media: MEDIA.adGroup,
      body: {
        campaignIdFilter: { include: [action.campaignId] },
        maxResults: 10,
      },
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
              campaignId: action.campaignId,
              name: "Default",
              state: "ENABLED",
              defaultBid: 1,
            },
          ],
        },
      },
      deps,
    );
    adGroupId = String(asArray(asRecord(asRecord(created).adGroups).success)[0]?.adGroupId ?? "");
  }
  if (!adGroupId) throw new AdsApiError("Amazon Ads did not return an ad group for that campaign.", 422);

  const updates = action.keywords.filter((keyword) => keyword.keywordId);
  const creates = action.keywords.filter((keyword) => !keyword.keywordId);
  let after: unknown = {};
  if (updates.length) {
    after = await amazonFetch(
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
    const failure = mutationError(after, "keywords");
    if (failure) throw new AdsApiError(failure, 422);
  }
  if (creates.length) {
    after = await amazonFetch(
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
    const failure = mutationError(after, "keywords");
    if (failure) throw new AdsApiError(failure, 422);
  }
  return {
    summary: `Updated ${action.keywords.length} keyword(s) on ${action.campaignId}.`,
    before: null,
    after,
  };
}
