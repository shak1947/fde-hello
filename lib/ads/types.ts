export const DELIVERY_STATES = ["ENABLED", "PAUSED"] as const;
export type DeliveryState = (typeof DELIVERY_STATES)[number];

export const MATCH_TYPES = ["EXACT", "PHRASE", "BROAD"] as const;
export type MatchType = (typeof MATCH_TYPES)[number];

export const TARGETING_TYPES = ["MANUAL", "AUTO"] as const;
export type TargetingType = (typeof TARGETING_TYPES)[number];

export const NEGATIVE_MATCH_TYPES = ["NEGATIVE_EXACT", "NEGATIVE_PHRASE", "NEGATIVE_BROAD"] as const;
export type NegativeMatchType = (typeof NEGATIVE_MATCH_TYPES)[number];

export const NEGATIVE_SCOPES = ["CAMPAIGN", "AD_GROUP"] as const;
export type NegativeScope = (typeof NEGATIVE_SCOPES)[number];

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

export type NegativeEntry = {
  entryId: string;
  campaignId: string;
  adGroupId: string;
  scope: NegativeScope;
  kind: "KEYWORD" | "ASIN";
  value: string;
  matchType: NegativeMatchType | "ASIN_SAME_AS";
  state: DeliveryState;
};

export type ProductTarget = {
  targetId: string;
  campaignId: string;
  adGroupId: string;
  asin: string;
  bid: number;
  state: DeliveryState;
};

export type ProductAd = {
  adId: string;
  campaignId: string;
  adGroupId: string;
  asin: string;
  sku: string;
  state: DeliveryState;
};

export type SearchTerm = {
  searchTerm: string;
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  impressions: number;
  clicks: number;
  cost: number;
  sales: number;
  orders: number;
  sample: boolean;
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
  kitId?: string;
  keywords: Keyword[];
  negatives: NegativeEntry[];
  productTargets: ProductTarget[];
  productAds: ProductAd[];
};

export type CreateCampaignAction = {
  type: "create_campaign";
  name: string;
  dailyBudget: number;
  targetingType: TargetingType;
  state: DeliveryState;
  kitId?: string;
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

export type UpdateKeywordAction = {
  type: "update_keyword";
  campaignId: string;
  keywordId: string;
  bid?: number;
  state?: DeliveryState;
};

export type AddKeywordAction = {
  type: "add_keyword";
  campaignId: string;
  adGroupId?: string;
  keywordText: string;
  matchType: MatchType;
  bid: number;
  state: DeliveryState;
};

export type AddNegativeAction = {
  type: "add_negative";
  campaignId: string;
  adGroupId?: string;
  scope: NegativeScope;
  kind: "KEYWORD" | "ASIN";
  keywordText?: string;
  matchType?: NegativeMatchType;
  asin?: string;
  state: DeliveryState;
};

export type ApplySearchTermAction = {
  type: "apply_search_term";
  campaignId: string;
  adGroupId?: string;
  searchTerm: string;
  as: "KEYWORD" | "NEGATIVE_KEYWORD" | "NEGATIVE_ASIN";
  matchType: MatchType | NegativeMatchType;
  bid?: number;
  scope?: NegativeScope;
  state: DeliveryState;
};

export type UpsertProductTargetAction = {
  type: "upsert_product_target";
  campaignId: string;
  adGroupId?: string;
  targetId?: string;
  asin: string;
  bid?: number;
  state: DeliveryState;
};

export type ManageProductAdAction = {
  type: "manage_product_ad";
  campaignId: string;
  adGroupId?: string;
  adId?: string;
  asin?: string;
  sku?: string;
  state: DeliveryState;
};

export type AdsAction =
  | CreateCampaignAction
  | UpdateCampaignAction
  | SetBudgetAction
  | SetCampaignStateAction
  | UpsertKeywordsAction
  | UpdateKeywordAction
  | AddKeywordAction
  | AddNegativeAction
  | ApplySearchTermAction
  | UpsertProductTargetAction
  | ManageProductAdAction;

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

export type DecisionChallenge = {
  intent: string;
  expectedSpend: number;
  expectedAcos: number | null;
  expectedTacos: number | null;
  expectedOrders: number;
  timelineDays: number;
  defense: string;
  strength: "stated" | "thin";
  question: string | null;
};

export type FeedbackActual = {
  spend: number;
  acos: number | null;
  tacos: number | null;
  orders: number;
  note: string;
  recordedAt: string;
};

export type FeedbackComparison = {
  verdict: "met" | "missed" | "mixed";
  early: boolean;
  lines: string[];
  stub: true;
};

export type FeedbackCheck = {
  id: string;
  proposalId: string;
  at: string;
  reviewAfter: string;
  actorId: string;
  actorLabel: string;
  kitId: string | null;
  kitName: string;
  summary: string;
  mode: AdsMode;
  challenge: DecisionChallenge;
  status: "awaiting" | "recorded";
  actual: FeedbackActual | null;
  comparison: FeedbackComparison | null;
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
  challenge?: DecisionChallenge;
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
  intent: string;
  expected: string;
  challengeStrength: "" | "stated" | "thin";
  detail: unknown;
};

export type AdsMode = "dry-run" | "live";
