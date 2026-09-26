import { z } from "zod";
import {
  DELIVERY_STATES,
  MATCH_TYPES,
  TARGETING_TYPES,
  type AdsAction,
} from "./types";

export const ALLOWED_TOOL_NAMES = [
  "list_campaigns",
  "list_keywords",
  "get_performance",
  "propose_create_campaign",
  "propose_update_campaign",
  "propose_set_budget",
  "propose_set_campaign_state",
  "propose_upsert_keywords",
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
    rule: "wipe-history",
    pattern:
      /\b(wipe|erase|purge|destroy|clear)\b[\s\S]{0,48}\b(history|account|logs?|data|records?)\b|\b(account|campaign)\s+history\b[\s\S]{0,24}\b(wipe|erase|delete|purge)\b/i,
    message:
      "Refused. This portal cannot wipe or delete account history.",
  },
  {
    rule: "bulk-delete",
    pattern:
      /\b(bulk\s+delete|delete\s+everything|delete\s+all|remove\s+all|remove\s+everything|destroy\s+all|archive\s+all|delete\s+every)\b|\b(delete|remove|archive|destroy)\b[\s\S]{0,40}\b(all|every|everything)\b[\s\S]{0,40}\b(campaigns?|keywords?|ads?|targets?|account)?\b/i,
    message:
      "Refused. Bulk delete and “delete everything” are not available. Pause a campaign if it should stop spending.",
  },
  {
    rule: "single-delete",
    pattern:
      /\b(delete|archive)\s+(the\s+)?(campaign|keyword|ad group|target)\b|\bremove\s+(the\s+)?(campaign|keyword|ad group)\b/i,
    message:
      "Refused. This portal does not delete campaigns or keywords. Pause them, or change the bid, match type, or budget.",
  },
  {
    rule: "billing",
    pattern:
      /\b(billing|payment method|credit card|debit card|bank account|payout|invoice|tax settings?|add a card)\b/i,
    message:
      "Refused. Billing and payment changes are outside this portal.",
  },
  {
    rule: "seller-central",
    pattern:
      /\b(seller central|inventory|manage listings?|product listings?|sku stock|fba\b|inbound shipment|restock|listing (edit|update|change))\b/i,
    message:
      "Refused. Listings, inventory, and Seller Central are outside Amazon Advertising.",
  },
  {
    rule: "other-assistant",
    pattern:
      /\b(grok bot|general assistant|another bot|other bots?|ignore (all |your |previous |prior )?instructions|jailbreak|do anything now)\b/i,
    message:
      "Refused. This desk only operates Amazon Advertising for Sensationally OT. It is not a general assistant.",
  },
];

export function screenText(text: string): DenyHit | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  for (const rule of DENY_RULES) {
    if (rule.pattern.test(trimmed)) {
      return { rule: rule.rule, message: rule.message };
    }
  }
  return null;
}

const FORBIDDEN_KEY =
  /^(delete|archive|wipe|purge|billing|payment|payments|invoice|listing|listings|inventory|sellercentral|seller_central)$/i;

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
          message: `Refused. “${key}” is not an allowed Amazon Ads change.`,
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
]);

export type ActionParse =
  | { ok: true; action: AdsAction }
  | { ok: false; status: number; error: string; deny?: DenyHit };

function cleanAction(action: AdsAction): AdsAction {
  if (action.type === "create_campaign" || action.type === "update_campaign") {
    if (action.type === "create_campaign") {
      return { ...action, name: tidy(action.name) };
    }
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
  return action;
}

function tidy(value: string): string {
  return value.replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim();
}

export function parseAction(input: unknown, rawText?: string): ActionParse {
  const textHit = rawText ? screenText(rawText) : null;
  if (textHit) return { ok: false, status: 403, error: textHit.message, deny: textHit };
  const valueHit = screenValue(input);
  if (valueHit) return { ok: false, status: 403, error: valueHit.message, deny: valueHit };

  const parsed = actionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: "That change is not in the Amazon Ads allowlist.",
    };
  }
  const action = cleanAction(parsed.data);
  if (action.type === "update_campaign" && !action.name && !action.state) {
    return { ok: false, status: 400, error: "Name or on/off state is required." };
  }
  if (
    (action.type === "create_campaign" && !action.name) ||
    (action.type === "upsert_keywords" && action.keywords.some((k) => !k.keywordText))
  ) {
    return { ok: false, status: 400, error: "Name or keyword text is empty." };
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
  "I only operate Amazon Advertising for Sensationally OT. Spend is Shakeel Amir’s. I can list campaigns, create or rename one, change keywords, set a daily budget, and turn campaigns on or off. Every write waits for your confirmation. I will not delete history, delete campaigns, touch billing, or open Seller Central.";
