import { z } from "zod";
import { BID_CAP_ENV, BUDGET_CAP_ENV, capFailure, readCap } from "./caps";
import { adsMode } from "./mode";
import { redactSecrets } from "./redact";
import {
  DELIVERY_STATES,
  MATCH_TYPES,
  NEGATIVE_MATCH_TYPES,
  NEGATIVE_SCOPES,
  TARGETING_TYPES,
  type AdsAction,
  type MatchType,
  type NegativeMatchType,
} from "./types";

export const BLOCKED_TOOL_MESSAGE =
  "Access is limited to Amazon PPC, Sellerboard, and Helium 10.";

export const ALLOWED_TOOL_NAMES = [
  "list_campaigns",
  "list_keywords",
  "get_performance",
  "propose_create_campaign",
  "propose_update_campaign",
  "propose_set_budget",
  "propose_set_campaign_state",
  "propose_upsert_keywords",
  "propose_update_keyword",
  "propose_add_negative",
  "propose_apply_search_term",
  "propose_upsert_product_target",
  "propose_manage_product_ad",
  "list_search_terms",
  "sellerboard_snapshot",
  "helium10_snapshot",
] as const;

export type AllowedToolName = (typeof ALLOWED_TOOL_NAMES)[number];

const allowedToolSet = new Set<string>(ALLOWED_TOOL_NAMES);

export function isAllowedTool(name: string): name is AllowedToolName {
  return allowedToolSet.has(name);
}

export type DenyHit = {
  rule: string;
  message: string;
};

const DENY_RULES: { rule: string; pattern: RegExp; message: string }[] = [
  {
    rule: "credentials",
    pattern:
      /\b(passwords?|api[_ -]?keys?|client[_ -]?secrets?|refresh[_ -]?tokens?|access[_ -]?tokens?|raw credentials|secret keys?|\.env\b|show (me )?(the )?(credentials|secrets?))\b/i,
    message: `Refused. Passwords and API keys stay on the server. ${BLOCKED_TOOL_MESSAGE}`,
  },
  {
    rule: "mailbox",
    pattern:
      /\b(gmail|google mail|inbox|mailbox|outlook|hotmail|yahoo mail|send (me )?an? e-?mail|e-?mail me|read (my |the )?(e-?mail|inbox|mail)|check (my )?e-?mail)\b/i,
    message: `Refused. ${BLOCKED_TOOL_MESSAGE}`,
  },
  {
    rule: "wipe-history",
    pattern:
      /\b(wipe|erase|purge|destroy|clear)\b[\s\S]{0,48}\b(history|account|logs?|data|records?)\b|\b(account|campaign)\s+history\b[\s\S]{0,24}\b(wipe|erase|delete|purge)\b/i,
    message: `Refused. This portal cannot wipe or delete account history. ${BLOCKED_TOOL_MESSAGE}`,
  },
  {
    rule: "bulk-delete",
    pattern:
      /\b(bulk\s+delete|delete\s+everything|delete\s+all|remove\s+all|remove\s+everything|destroy\s+all|archive\s+all|delete\s+every)\b|\b(delete|remove|archive|destroy)\b[\s\S]{0,40}\b(all|every|everything)\b[\s\S]{0,40}\b(campaigns?|keywords?|ads?|targets?|account)?\b/i,
    message: `Refused. Bulk delete and “delete everything” are not available. Pause a campaign if it should stop spending. ${BLOCKED_TOOL_MESSAGE}`,
  },
  {
    rule: "archive",
    pattern: /\b(un)?archiv(?:e|ed|ing)\b/i,
    message: `Refused. Archiving campaigns, keywords, targets, or product ads is not available. Pause them instead. ${BLOCKED_TOOL_MESSAGE}`,
  },
  {
    rule: "single-delete",
    pattern:
      /\b(delete|remove)\s+(the\s+)?(campaign|keyword|ad group|target|product ad|asin)\b/i,
    message: `Refused. This portal does not delete campaigns, keywords, targets, or product ads. Pause them, or change the bid, match type, or budget. ${BLOCKED_TOOL_MESSAGE}`,
  },
  {
    rule: "billing",
    pattern:
      /\b(billing|payment method|credit card|debit card|bank account|payout|invoice|tax settings?|add a card)\b/i,
    message: `Refused. Billing and payment changes are outside this portal. ${BLOCKED_TOOL_MESSAGE}`,
  },
  {
    rule: "helium-manage",
    pattern:
      /\b(helium\s*10|h10|helium)\s+manage\b|\bmanage\b[\s\S]{0,40}\b(helium\s*10|h10)\b|\bhelium\s*(10\s+)?manage\b/i,
    message: `Refused. Helium 10 Manage writes are not available. Helium 10 stays analysis only. ${BLOCKED_TOOL_MESSAGE}`,
  },
  {
    rule: "analysis-write",
    pattern:
      /\b(update|change|edit|delete|create|upload|connect|sync|write)\s+(?:the\s+|my\s+|our\s+|a\s+)?(sellerboard|helium\s*10|h10)\b|\b(sellerboard|helium\s*10|h10)\b\s+(settings|password|account|project|listing)\b/i,
    message: `Refused. Sellerboard and Helium 10 are analysis only. ${BLOCKED_TOOL_MESSAGE}`,
  },
  {
    rule: "seller-central",
    pattern:
      /\b(manage listings?|product listings?|sku stock|fba\b|inbound shipment|restock|listing (edit|update|change)|product inventory|inventory levels|customer orders|manage orders|order reports?|buyer messages?)\b/i,
    message: `Refused. ${BLOCKED_TOOL_MESSAGE}`,
  },
  {
    rule: "other-assistant",
    pattern:
      /\b(grok\s*bots?|other grok|internal platforms?|internal tools?|general assistant|another bot|other bots?|ignore (all |your |previous |prior )?instructions|jailbreak|do anything now)\b/i,
    message: `Refused. ${BLOCKED_TOOL_MESSAGE}`,
  },
];

const SELLER_CENTRAL_OUTSIDE =
  /\b(listings?|inventory|fba|inbound shipments?|restock|buyer messages?|customer orders|manage orders|order reports?|returns?|account health)\b/i;

const ADS_CONSOLE = /\b(ads|advertising|ppc|campaigns?|sponsored)\b/i;

export function screenText(text: string): DenyHit | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (/\bseller central\b/i.test(trimmed) && (SELLER_CENTRAL_OUTSIDE.test(trimmed) || !ADS_CONSOLE.test(trimmed))) {
    return { rule: "seller-central", message: `Refused. ${BLOCKED_TOOL_MESSAGE}` };
  }
  if (/\binventory\b/i.test(trimmed) && !/\b(keyword|ad|campaign) inventory\b/i.test(trimmed)) {
    return { rule: "seller-central", message: `Refused. ${BLOCKED_TOOL_MESSAGE}` };
  }
  for (const rule of DENY_RULES) {
    if (rule.pattern.test(trimmed)) {
      return { rule: rule.rule, message: rule.message };
    }
  }
  return null;
}

const FORBIDDEN_KEY =
  /^(delete|archive|wipe|purge|billing|payment|payments|invoice|listing|listings|inventory|sellercentral|seller_central|email|gmail|mailbox|password|secret|apikey|api_key|refreshtoken|refresh_token|clientsecret|client_secret|credentials|accesstoken|access_token)$/i;

export function screenValue(value: unknown, trail = ""): DenyHit | null {
  if (typeof value === "string") {
    return screenText(value);
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const hit = screenValue(entry, trail);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (FORBIDDEN_KEY.test(key)) {
        return {
          rule: "forbidden-field",
          message: `Refused. That field is not allowed. Passwords and API keys stay on the server. ${BLOCKED_TOOL_MESSAGE}`,
        };
      }
      const hit = screenValue(entry, `${trail}.${key}`);
      if (hit) return hit;
    }
  }
  return null;
}

const money = z.number().gt(0).max(50_000);

const keywordInput = z.object({
  keywordId: z.string().min(1).max(80).optional(),
  keywordText: z.string().min(1).max(80),
  matchType: z.enum(MATCH_TYPES),
  bid: money,
  state: z.enum(DELIVERY_STATES),
  negative: z.boolean().optional(),
});

const asinSchema = z
  .string()
  .trim()
  .regex(/^B0[A-Z0-9]{8}$/i)
  .transform((value) => value.toUpperCase());

const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create_campaign"),
    name: z.string().min(1).max(120),
    dailyBudget: money,
    targetingType: z.enum(TARGETING_TYPES),
    state: z.enum(DELIVERY_STATES),
  }),
  z.object({
    type: z.literal("update_campaign"),
    campaignId: z.string().min(1).max(80),
    name: z.string().min(1).max(120).optional(),
    state: z.enum(DELIVERY_STATES).optional(),
  }),
  z.object({
    type: z.literal("set_budget"),
    campaignId: z.string().min(1).max(80),
    dailyBudget: money,
  }),
  z.object({
    type: z.literal("set_campaign_state"),
    campaignIds: z.array(z.string().min(1).max(80)).min(1).max(50),
    state: z.enum(DELIVERY_STATES),
  }),
  z.object({
    type: z.literal("upsert_keywords"),
    campaignId: z.string().min(1).max(80),
    keywords: z.array(keywordInput).min(1).max(25),
  }),
  z.object({
    type: z.literal("update_keyword"),
    campaignId: z.string().min(1).max(80),
    keywordId: z.string().min(1).max(80),
    bid: money.optional(),
    state: z.enum(DELIVERY_STATES).optional(),
  }),
  z.object({
    type: z.literal("add_keyword"),
    campaignId: z.string().min(1).max(80),
    adGroupId: z.string().min(1).max(80).optional(),
    keywordText: z.string().min(1).max(80),
    matchType: z.enum(MATCH_TYPES),
    bid: money,
    state: z.enum(DELIVERY_STATES),
  }),
  z.object({
    type: z.literal("add_negative"),
    campaignId: z.string().min(1).max(80),
    adGroupId: z.string().min(1).max(80).optional(),
    scope: z.enum(NEGATIVE_SCOPES),
    kind: z.enum(["KEYWORD", "ASIN"]),
    keywordText: z.string().min(1).max(80).optional(),
    matchType: z.enum(NEGATIVE_MATCH_TYPES).optional(),
    asin: asinSchema.optional(),
    state: z.enum(DELIVERY_STATES),
  }),
  z.object({
    type: z.literal("apply_search_term"),
    campaignId: z.string().min(1).max(80),
    adGroupId: z.string().min(1).max(80).optional(),
    searchTerm: z.string().min(1).max(80),
    as: z.enum(["KEYWORD", "NEGATIVE_KEYWORD", "NEGATIVE_ASIN"]),
    matchType: z.union([z.enum(MATCH_TYPES), z.enum(NEGATIVE_MATCH_TYPES)]),
    bid: money.optional(),
    scope: z.enum(NEGATIVE_SCOPES).optional(),
    state: z.enum(DELIVERY_STATES),
  }),
  z.object({
    type: z.literal("upsert_product_target"),
    campaignId: z.string().min(1).max(80),
    adGroupId: z.string().min(1).max(80).optional(),
    targetId: z.string().min(1).max(80).optional(),
    asin: asinSchema,
    bid: money.optional(),
    state: z.enum(DELIVERY_STATES),
  }),
  z.object({
    type: z.literal("manage_product_ad"),
    campaignId: z.string().min(1).max(80),
    adGroupId: z.string().min(1).max(80).optional(),
    adId: z.string().min(1).max(80).optional(),
    asin: asinSchema.optional(),
    sku: z.string().min(1).max(80).optional(),
    state: z.enum(DELIVERY_STATES),
  }),
]);

export type ActionParse =
  | { ok: true; action: AdsAction }
  | { ok: false; status: number; error: string; deny?: DenyHit };

function cleanAction(action: AdsAction): AdsAction {
  if (action.type === "create_campaign") return { ...action, name: tidy(action.name) };
  if (action.type === "update_campaign") {
    return { ...action, name: action.name ? tidy(action.name) : undefined };
  }
  if (action.type === "upsert_keywords") {
    return {
      ...action,
      keywords: action.keywords.map((keyword) => ({
        ...keyword,
        keywordText: tidy(keyword.keywordText),
        negative: Boolean(keyword.negative),
      })),
    };
  }
  if (action.type === "add_keyword") return { ...action, keywordText: tidy(action.keywordText) };
  if (action.type === "add_negative") {
    return {
      ...action,
      keywordText: action.keywordText ? tidy(action.keywordText) : undefined,
      asin: action.asin?.toUpperCase(),
    };
  }
  if (action.type === "apply_search_term") return { ...action, searchTerm: tidy(action.searchTerm) };
  if (action.type === "upsert_product_target") return { ...action, asin: action.asin.toUpperCase() };
  if (action.type === "manage_product_ad") {
    return { ...action, asin: action.asin?.toUpperCase(), sku: action.sku ? tidy(action.sku) : undefined };
  }
  return action;
}

function tidy(value: string): string {
  return value.replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim();
}

function blockedActionType(input: unknown): ActionParse | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const type = (input as { type?: unknown }).type;
  if (typeof type !== "string") return null;
  if (/^(sellerboard_snapshot|helium10_snapshot)$/i.test(type)) {
    return {
      ok: false,
      status: 403,
      error: `Refused. Sellerboard and Helium 10 are analysis only. ${BLOCKED_TOOL_MESSAGE}`,
      deny: { rule: "analysis-write", message: `Refused. Sellerboard and Helium 10 are analysis only. ${BLOCKED_TOOL_MESSAGE}` },
    };
  }
  if (/archive|delete|billing|sb_|sd_|sponsoredbrands|sponsoreddisplay/i.test(type)) {
    const hit = {
      rule: "archive",
      message: `Refused. Archive, delete, billing, Sponsored Brands, and Sponsored Display writes are not available. ${BLOCKED_TOOL_MESSAGE}`,
    };
    return { ok: false, status: 403, error: hit.message, deny: hit };
  }
  if (/email|gmail|mail|listing|inventory|order|password|secret|credential|grok|bot|helium|sellerboard/i.test(type)) {
    const hit = {
      rule: "out-of-scope",
      message: `Refused. ${BLOCKED_TOOL_MESSAGE}`,
    };
    return { ok: false, status: 403, error: hit.message, deny: hit };
  }
  return null;
}

function containsArchived(value: unknown): boolean {
  if (value === "ARCHIVED") return true;
  if (Array.isArray(value)) return value.some((entry) => containsArchived(entry));
  if (value && typeof value === "object") return Object.values(value).some((entry) => containsArchived(entry));
  return false;
}

function budgetAmounts(action: AdsAction): number[] {
  if (action.type === "create_campaign" || action.type === "set_budget") return [action.dailyBudget];
  return [];
}

function bidAmounts(action: AdsAction): number[] {
  if (action.type === "upsert_keywords") {
    return action.keywords.filter((keyword) => !keyword.negative).map((keyword) => keyword.bid);
  }
  if (action.type === "add_keyword") return [action.bid];
  if (action.type === "update_keyword" && action.bid != null) return [action.bid];
  if (action.type === "upsert_product_target" && action.bid != null) return [action.bid];
  if (action.type === "apply_search_term" && action.as === "KEYWORD" && action.bid != null) return [action.bid];
  return [];
}

function shapeError(action: AdsAction): string | null {
  if (action.type === "update_campaign" && !action.name && !action.state) return "Name or on/off state is required.";
  if (action.type === "create_campaign" && !action.name) return "Name is empty.";
  if (action.type === "upsert_keywords" && action.keywords.some((keyword) => !keyword.keywordText)) {
    return "Keyword text is empty.";
  }
  if (action.type === "update_keyword" && action.bid == null && !action.state) return "Bid or on/off state is required.";
  if (action.type === "add_keyword" && !action.keywordText) return "Keyword text is empty.";
  if (action.type === "add_negative") {
    if (action.kind === "KEYWORD" && (!action.keywordText || !action.matchType)) {
      return "A negative keyword needs text and a negative match type.";
    }
    if (action.kind === "ASIN" && !action.asin) return "A negative ASIN target needs a 10-character ASIN.";
    if (action.scope === "AD_GROUP" && action.adGroupId === "") return "Ad group id is empty.";
  }
  if (action.type === "apply_search_term") {
    if (!action.searchTerm) return "Search term is empty.";
    if (action.as === "KEYWORD") {
      if (!isPositiveMatch(action.matchType) || action.bid == null) {
        return "Applying a search term as a keyword needs an exact, phrase, or broad match and a bid.";
      }
    }
    if (action.as === "NEGATIVE_KEYWORD" && !isNegativeMatch(action.matchType)) {
      return "Applying a search term as a negative keyword needs a negative match type.";
    }
    if (action.as === "NEGATIVE_ASIN" && !/^B0[A-Z0-9]{8}$/i.test(action.searchTerm)) {
      return "Only an ASIN-shaped search term can be applied as a negative ASIN.";
    }
  }
  if (action.type === "upsert_product_target" && !action.targetId && action.bid == null) {
    return "A new product target needs a bid.";
  }
  if (action.type === "manage_product_ad" && !action.adId && !action.asin && !action.sku) {
    return "A product ad needs an ASIN or SKU to add, or an ad id to pause or enable.";
  }
  return null;
}

function isPositiveMatch(value: string): value is MatchType {
  return (MATCH_TYPES as readonly string[]).includes(value);
}

function isNegativeMatch(value: string): value is NegativeMatchType {
  return (NEGATIVE_MATCH_TYPES as readonly string[]).includes(value);
}

function capError(action: AdsAction): string | null {
  const live = adsMode() === "live";
  return (
    capFailure(BUDGET_CAP_ENV, "Daily budget", budgetAmounts(action), readCap(BUDGET_CAP_ENV), live) ||
    capFailure(BID_CAP_ENV, "Bid", bidAmounts(action), readCap(BID_CAP_ENV), live)
  );
}

export function parseAction(input: unknown, rawText?: string): ActionParse {
  const textHit = rawText ? screenText(rawText) : null;
  if (textHit) return { ok: false, status: 403, error: redactSecrets(textHit.message), deny: textHit };
  const valueHit = screenValue(input);
  if (valueHit) return { ok: false, status: 403, error: redactSecrets(valueHit.message), deny: valueHit };
  if (containsArchived(input)) {
    const hit = {
      rule: "archive",
      message: `Refused. ARCHIVED is not a state this portal can send. Pause instead. ${BLOCKED_TOOL_MESSAGE}`,
    };
    return { ok: false, status: 403, error: hit.message, deny: hit };
  }
  const blockedType = blockedActionType(input);
  if (blockedType) return blockedType;

  const parsed = actionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: `That change is not available. ${BLOCKED_TOOL_MESSAGE}`,
    };
  }
  const action = cleanAction(parsed.data);
  const shape = shapeError(action);
  if (shape) return { ok: false, status: 400, error: shape };
  const capped = capError(action);
  if (capped) {
    const hit = { rule: "spend-cap", message: capped };
    return { ok: false, status: 403, error: redactSecrets(capped), deny: hit };
  }
  return { ok: true, action };
}

const ADS_LEXICON =
  /\b(campaigns?|keywords?|bids?|budgets?|pause|paused|enable|enabled|resume|spend|spending|sponsored|ppc|acos|roas|exact|phrase|broad|impressions?|clicks?|sales|ads?|advertising|portfolio|negative)\b/i;

const GREETING =
  /^(hi|hello|hey|help|what can you do|who are you)\b[^.?!]{0,40}[.?!]?$/i;

export function looksLikeAdsWork(text: string): boolean {
  return ADS_LEXICON.test(text);
}

export function isGreeting(text: string): boolean {
  return GREETING.test(text.trim());
}

export const SCOPE_INTRO =
  "Access is limited to Amazon PPC, Sellerboard, and Helium 10. On Amazon PPC I can list campaigns, create or rename one, change keywords, set a daily budget, and turn campaigns on or off. Every PPC write waits for confirmation. Sellerboard and Helium 10 are analysis only. I do not open email, Seller Central listings, orders, or inventory, other bots, or internal platforms. I never show passwords or API keys.";
