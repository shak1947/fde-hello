import { kitNeedles } from "./catalog";
import { redactSecrets } from "./redact";
import type { AdsAction, Campaign, DecisionChallenge, FeedbackActual, FeedbackComparison } from "./types";

const WEAK_INTENT =
  /^(test|testing|try|trying|see|idk|ok|okay|yes|do it|fix|update|change|optimize|optimise|improve|just because|because)\.?$/i;

export function actionCampaignIds(action: AdsAction): string[] {
  if (action.type === "set_campaign_state") return action.campaignIds;
  if (action.type === "create_campaign") return [];
  return [action.campaignId];
}

export type ChallengeParse =
  | { ok: true; challenge: DecisionChallenge }
  | { ok: false; status: 400 | 409; error: string; question?: string };

export function parseChallenge(input: unknown, summary: string, campaigns: Campaign[], action: AdsAction): ChallengeParse {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      status: 400,
      error:
        "Confirm needs the manager’s intent and the outcome they expect: spend, ACoS or TACOS, orders, and a timeline in days.",
    };
  }
  const body = input as Record<string, unknown>;
  const intent = typeof body.intent === "string" ? body.intent.replace(/\s+/g, " ").trim() : "";
  const defense = typeof body.defense === "string" ? body.defense.replace(/\s+/g, " ").trim() : "";
  const expectedSpend = readNumber(body.expectedSpend);
  const expectedAcos = readOptionalNumber(body.expectedAcos);
  const expectedTacos = readOptionalNumber(body.expectedTacos);
  const expectedOrders = readNumber(body.expectedOrders);
  const timelineDays = readNumber(body.timelineDays);

  if (intent.length < 12) {
    return {
      ok: false,
      status: 400,
      error: "Intent is too short to be a decision. Say what is changing and which kit it is for.",
    };
  }
  if (intent.length > 500) {
    return { ok: false, status: 400, error: "Intent is too long. Keep it to the change and the kit." };
  }
  if (expectedSpend == null || expectedSpend < 0 || expectedSpend > 100000) {
    return { ok: false, status: 400, error: "Expected spend is required, in dollars, for the timeline you named." };
  }
  if (expectedAcos == null && expectedTacos == null) {
    return {
      ok: false,
      status: 400,
      error: "Name an ACoS target or a TACOS target. A budget with no efficiency bet is not a decision.",
    };
  }
  if (expectedAcos != null && (expectedAcos < 0 || expectedAcos > 200)) {
    return { ok: false, status: 400, error: "Expected ACoS must be a percent from 0 to 200." };
  }
  if (expectedTacos != null && (expectedTacos < 0 || expectedTacos > 200)) {
    return { ok: false, status: 400, error: "Expected TACOS must be a percent from 0 to 200." };
  }
  if (expectedOrders == null || !Number.isInteger(expectedOrders) || expectedOrders < 0 || expectedOrders > 100000) {
    return { ok: false, status: 400, error: "Expected orders is required as a whole number for this timeline." };
  }
  if (timelineDays == null || !Number.isInteger(timelineDays) || timelineDays < 1 || timelineDays > 180) {
    return { ok: false, status: 400, error: "Timeline must be a whole number of days from 1 to 180." };
  }

  const needles = kitNeedles(campaigns, action.type === "create_campaign" ? action.kitId : undefined, actionCampaignIds(action));
  const reasons: string[] = [];
  if (intent.length < 40 || WEAK_INTENT.test(intent) || normalize(intent) === normalize(summary)) {
    reasons.push("What is the bet on this kit? Name the product and the result you expect, not only the control you pressed.");
  }
  if (!mentions(intent, needles)) {
    reasons.push("Which kit is this for — Mermaid dough or Farm dough? A change that does not name the product is not ready to confirm.");
  }
  if (timelineDays < 7) {
    reasons.push("Seven days is the shortest window that can show a result on this catalog. Why should this run on a shorter clock?");
  }
  if (timelineDays > 45) {
    reasons.push("Past 45 days this catalog cannot hold anyone to the bet. What date will you actually check?");
  }
  if ((expectedAcos != null && expectedAcos > 60) || (expectedTacos != null && expectedTacos > 30)) {
    reasons.push("That efficiency target is loose for a two-kit catalog. Why is this still the right spend?");
  }

  const question = reasons.length ? reasons.slice(0, 2).join(" ") : null;
  if (question && defense.length < 24) {
    return { ok: false, status: 409, error: question, question };
  }

  return {
    ok: true,
    challenge: {
      intent: redactSecrets(intent),
      expectedSpend: roundMoney(expectedSpend),
      expectedAcos: expectedAcos == null ? null : roundPercent(expectedAcos),
      expectedTacos: expectedTacos == null ? null : roundPercent(expectedTacos),
      expectedOrders,
      timelineDays,
      defense: redactSecrets(defense),
      strength: question ? "thin" : "stated",
      question,
    },
  };
}

export function formatExpected(challenge: Pick<DecisionChallenge, "expectedSpend" | "expectedAcos" | "expectedTacos" | "expectedOrders" | "timelineDays">): string {
  const acos = challenge.expectedAcos == null ? "ACoS not set" : `ACoS ${challenge.expectedAcos}%`;
  const tacos = challenge.expectedTacos == null ? "TACOS not set" : `TACOS ${challenge.expectedTacos}%`;
  return `spend $${challenge.expectedSpend.toFixed(2)} · ${acos} · ${tacos} · ${challenge.expectedOrders} orders · ${challenge.timelineDays}d`;
}

export function compareOutcome(
  challenge: DecisionChallenge,
  actual: FeedbackActual,
  reviewAfter: string,
): FeedbackComparison {
  const flags: boolean[] = [];
  const lines: string[] = [];
  const spendMet = actual.spend <= challenge.expectedSpend;
  flags.push(spendMet);
  lines.push(
    spendMet
      ? `Spend $${actual.spend.toFixed(2)} is within the $${challenge.expectedSpend.toFixed(2)} bet.`
      : `Spend $${actual.spend.toFixed(2)} is over the $${challenge.expectedSpend.toFixed(2)} bet.`,
  );
  if (challenge.expectedAcos != null && actual.acos != null) {
    const met = actual.acos <= challenge.expectedAcos;
    flags.push(met);
    lines.push(met ? `ACoS ${actual.acos}% is within ${challenge.expectedAcos}%.` : `ACoS ${actual.acos}% is above the ${challenge.expectedAcos}% bet.`);
  } else if (challenge.expectedAcos != null) {
    lines.push("ACoS was part of the bet and was not recorded.");
  }
  if (challenge.expectedTacos != null && actual.tacos != null) {
    const met = actual.tacos <= challenge.expectedTacos;
    flags.push(met);
    lines.push(
      met ? `TACOS ${actual.tacos}% is within ${challenge.expectedTacos}%.` : `TACOS ${actual.tacos}% is above the ${challenge.expectedTacos}% bet.`,
    );
  } else if (challenge.expectedTacos != null) {
    lines.push("TACOS was part of the bet and was not recorded.");
  }
  const ordersMet = actual.orders >= challenge.expectedOrders;
  flags.push(ordersMet);
  lines.push(
    ordersMet
      ? `Orders ${actual.orders} meet the ${challenge.expectedOrders} order bet.`
      : `Orders ${actual.orders} are short of the ${challenge.expectedOrders} order bet.`,
  );
  const early = Date.now() < Date.parse(reviewAfter);
  if (early) lines.push("This check is earlier than the timeline on the bet.");
  lines.push("This comparison uses numbers entered on the desk. It does not pull a live Amazon report yet.");
  const metCount = flags.filter(Boolean).length;
  const verdict = metCount === flags.length ? "met" : metCount === 0 ? "missed" : "mixed";
  return { verdict, early, lines, stub: true };
}

export function readActual(input: unknown): { ok: true; actual: Omit<FeedbackActual, "recordedAt"> } | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Record spend, orders, and what happened. ACoS and TACOS can be blank." };
  }
  const body = input as Record<string, unknown>;
  const spend = readNumber(body.spend);
  const orders = readNumber(body.orders);
  const acos = readOptionalNumber(body.acos);
  const tacos = readOptionalNumber(body.tacos);
  const note = typeof body.note === "string" ? body.note.replace(/\s+/g, " ").trim() : "";
  if (spend == null || spend < 0 || spend > 100000) return { ok: false, error: "Actual spend is required." };
  if (orders == null || !Number.isInteger(orders) || orders < 0 || orders > 100000) {
    return { ok: false, error: "Actual orders are required as a whole number." };
  }
  if (acos != null && (acos < 0 || acos > 200)) return { ok: false, error: "Actual ACoS must be a percent from 0 to 200." };
  if (tacos != null && (tacos < 0 || tacos > 200)) return { ok: false, error: "Actual TACOS must be a percent from 0 to 200." };
  if (note.length < 8) return { ok: false, error: "Say what happened in a sentence. A number with no note is not a review." };
  return {
    ok: true,
    actual: {
      spend: roundMoney(spend),
      acos: acos == null ? null : roundPercent(acos),
      tacos: tacos == null ? null : roundPercent(tacos),
      orders,
      note: redactSecrets(note).slice(0, 500),
    },
  };
}

function mentions(intent: string, needles: string[]): boolean {
  if (!needles.length) return false;
  const text = intent.toLowerCase();
  return needles.some((needle) => {
    const token = needle.toLowerCase();
    if (token.length <= 6) return new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(intent);
    return text.includes(token);
  });
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readOptionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  return readNumber(value);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number): number {
  return Math.round(value * 10) / 10;
}
