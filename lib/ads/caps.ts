export type CapRead = { kind: "unset" } | { kind: "invalid" } | { kind: "set"; value: number };

const CAP_ENV = {
  budget: "ADS_MAX_DAILY_BUDGET",
  bid: "ADS_MAX_BID",
} as const;

export function readCap(name: string): CapRead {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return { kind: "unset" };
  const value = Number(raw.trim());
  if (!Number.isFinite(value) || value <= 0) return { kind: "invalid" };
  return { kind: "set", value };
}

export function publicCaps() {
  const budget = readCap(CAP_ENV.budget);
  const bid = readCap(CAP_ENV.bid);
  return {
    maxDailyBudget: budget.kind === "set" ? budget.value : null,
    maxBid: bid.kind === "set" ? bid.value : null,
    budgetStatus: budget.kind,
    bidStatus: bid.kind,
  };
}

export function capFailure(name: string, label: string, amounts: number[], cap: CapRead, live: boolean): string | null {
  if (!amounts.length) return null;
  if (cap.kind === "invalid") {
    return `${name} must be a positive number on the server. The value was rejected and is not shown.`;
  }
  if (cap.kind === "unset") {
    if (!live) return null;
    return `Set ${name} on the server before a live ${label.toLowerCase()} change. This write stays blocked until that cap is set.`;
  }
  const over = amounts.find((amount) => amount > cap.value + 1e-9);
  if (over == null) return null;
  return `${label} $${over.toFixed(2)} is above the server cap of $${cap.value.toFixed(2)} (${name}).`;
}

export const BUDGET_CAP_ENV = CAP_ENV.budget;
export const BID_CAP_ENV = CAP_ENV.bid;
