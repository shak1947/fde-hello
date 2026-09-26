import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { AuditEvent, Campaign, FeedbackCheck, Proposal } from "./types";
import { seedCampaigns } from "./seed";

export function normalizeCampaign(row: Campaign): Campaign {
  return {
    ...row,
    keywords: row.keywords ?? [],
    negatives: row.negatives ?? [],
    productTargets: row.productTargets ?? [],
    productAds: row.productAds ?? [],
  };
}

type Bucket = {
  file: string;
  campaigns: Campaign[];
  proposals: Proposal[];
  audit: AuditEvent[];
  feedback: FeedbackCheck[];
};

const globalStore = globalThis as typeof globalThis & {
  __sotAds?: Bucket;
};

function stateFile(): string {
  return (
    process.env.ADS_PORTAL_STATE_FILE ||
    path.join("/tmp", "sot-ads-portal-state.json")
  );
}

function normalizeAudit(event: AuditEvent): AuditEvent {
  return {
    ...event,
    intent: event.intent ?? "",
    expected: event.expected ?? "",
    challengeStrength: event.challengeStrength ?? "",
  };
}

function emptyBucket(file: string): Bucket {
  return { file, campaigns: seedCampaigns(), proposals: [], audit: [], feedback: [] };
}

function readBucket(file: string): Bucket {
  try {
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as Partial<Bucket>;
    return {
      file,
      campaigns: parsed.campaigns?.length ? parsed.campaigns.map(normalizeCampaign) : seedCampaigns(),
      proposals: parsed.proposals ?? [],
      audit: (parsed.audit ?? []).map(normalizeAudit),
      feedback: parsed.feedback ?? [],
    };
  } catch {
    return emptyBucket(file);
  }
}

function bucket(): Bucket {
  const file = stateFile();
  if (!globalStore.__sotAds || globalStore.__sotAds.file !== file) {
    globalStore.__sotAds = readBucket(file);
  }
  return globalStore.__sotAds;
}

function persist(current: Bucket) {
  const file = current.file;
  mkdirSync(path.dirname(file), { recursive: true });
  const { campaigns, proposals, audit, feedback } = current;
  writeFileSync(file, JSON.stringify({ campaigns, proposals, audit, feedback }));
}

let queue: Promise<void> = Promise.resolve();

export function withStore<T>(fn: (current: Bucket) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const current = bucket();
    const result = await fn(current);
    persist(current);
    return result;
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function resetForTests() {
  const file = stateFile();
  globalStore.__sotAds = emptyBucket(file);
  persist(globalStore.__sotAds);
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}
