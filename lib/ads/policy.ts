import { z } from "zod";
import { redactSecrets } from "./redact";
import {
  DELIVERY_STATES,
  MATCH_TYPES,
  TARGETING_TYPES,
  type AdsAction,
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
    rule: "single-delete",
    pattern:
      /\b(delete|archive)\s+(the\s+)?(campaign|keyword|ad group|target)\b|\bremove\s+(the\s+)?(campaign|keyword|ad group)\b/i,
    message: `Refused. This portal does not delete campaigns or keywords. Pause them, or change the bid, match type, or budget. ${BLOCKED_TOOL_MESSAGE}`,
  },
  {
    rule: "billing",
    pattern:
      /\b(billing|payment method|credit card|debit card|bank account|payout|invoice|tax settings?|add a card)\b/i,
    message: `Refused. Billing and payment changes are outside this portal. ${BLOCKED_TOOL_MESSAGE}`,
  },
  {
    rule: "analysis-write",
    pattern:
      /\b(update|change|edit|delete|create|upload|connect|sync)\s+(?:the\s+|my\s+|our\s+)?(sellerboard|helium\s*10|h10)\b|\b(sellerboard|helium\s*10|h10)\b\s+(settings|password|account|project)\b/i,
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
  if (/email|gmail|mail|listing|inventory|order|password|secret|credential|grok|bot/i.test(type)) {
    const hit = {
      rule: "out-of-scope",
      message: `Refused. ${BLOCKED_TOOL_MESSAGE}`,
    };
    return { ok: false, status: 403, error: hit.message, deny: hit };
  }
  return null;
}

export function parseAction(input: unknown, rawText?: string): ActionParse {
  const textHit = rawText ? screenText(rawText) : null;
  if (textHit) return { ok: false, status: 403, error: redactSecrets(textHit.message), deny: textHit };
  const valueHit = screenValue(input);
  if (valueHit) return { ok: false, status: 403, error: redactSecrets(valueHit.message), deny: valueHit };
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
  "Access is limited to Amazon PPC, Sellerboard, and Helium 10. On Amazon PPC I can list campaigns, create or rename one, change keywords, set a daily budget, and turn campaigns on or off. Every PPC write waits for confirmation. Sellerboard and Helium 10 are analysis only. I do not open email, Seller Central listings, orders, or inventory, other bots, or internal platforms. I never show passwords or API keys.";
