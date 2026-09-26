export const DELIVERY_STATES = ["ENABLED", "PAUSED"] as const;
export type DeliveryState = (typeof DELIVERY_STATES)[number];

export const MATCH_TYPES = ["EXACT", "PHRASE", "BROAD"] as const;
export type MatchType = (typeof MATCH_TYPES)[number];

export const TARGETING_TYPES = ["MANUAL", "AUTO"] as const;
export type TargetingType = (typeof TARGETING_TYPES)[number];

export type Keyword = {
  keywordId: string;
  campaignId: string;
  adGroupId: string;
  keywordText: string;
  matchType: MatchType;
  bid: number;
  state: DeliveryState;
  negative: boolean;
};

export type Campaign = {
  campaignId: string;
  name: string;
  state: DeliveryState;
  targetingType: TargetingType;
  dailyBudget: number;
  spend: number | null;
  sales: number | null;
  clicks: number | null;
  impressions: number | null;
  simulated: boolean;
  adGroupId: string;
  keywords: Keyword[];
};

export type CreateCampaignAction = {
  type: "create_campaign";
  name: string;
  dailyBudget: number;
  targetingType: TargetingType;
  state: DeliveryState;
};

export type UpdateCampaignAction = {
  type: "update_campaign";
  campaignId: string;
  name?: string;
  state?: DeliveryState;
};

export type SetBudgetAction = {
  type: "set_budget";
  campaignId: string;
  dailyBudget: number;
};

export type SetCampaignStateAction = {
  type: "set_campaign_state";
  campaignIds: string[];
  state: DeliveryState;
};

export type KeywordInput = {
  keywordId?: string;
  keywordText: string;
  matchType: MatchType;
  bid: number;
  state: DeliveryState;
  negative?: boolean;
};

export type UpsertKeywordsAction = {
  type: "upsert_keywords";
  campaignId: string;
  keywords: KeywordInput[];
};

export type AdsAction =
  | CreateCampaignAction
  | UpdateCampaignAction
  | SetBudgetAction
  | SetCampaignStateAction
  | UpsertKeywordsAction;

export type Actor = {
  id: string;
  label: string;
};

export type ProposalStatus = "pending" | "applied" | "rejected" | "failed";

export type ApplyResult = {
  summary: string;
  before: unknown;
  after: unknown;
  mode: "dry-run" | "live";
};

export type Proposal = {
  id: string;
  createdAt: string;
  expiresAt: string;
  actorId: string;
  actorLabel: string;
  status: ProposalStatus;
  summary: string;
  action: AdsAction;
  result?: ApplyResult;
  error?: string;
};

export type AuditStatus = "applied" | "denied" | "failed" | "rejected";

export type AuditEvent = {
  id: string;
  at: string;
  actorId: string;
  actorLabel: string;
  mode: "dry-run" | "live";
  actionType: string;
  status: AuditStatus;
  summary: string;
  detail: unknown;
};

export type AdsMode = "dry-run" | "live";
