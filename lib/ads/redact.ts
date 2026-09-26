const SECRET_ENV = [
  "ADS_PORTAL_PASSWORD",
  "AMAZON_ADS_CLIENT_ID",
  "AMAZON_ADS_CLIENT_SECRET",
  "AMAZON_ADS_REFRESH_TOKEN",
  "AMAZON_ADS_PROFILE_ID",
  "CLERK_SECRET_KEY",
  "AI_GATEWAY_API_KEY",
  "SELLERBOARD_API_TOKEN",
  "HELIUM10_API_KEY",
] as const;

export function redactSecrets(value: string): string {
  let out = value;
  for (const name of SECRET_ENV) {
    const secret = process.env[name];
    if (!secret || secret.length < 6 || !out.includes(secret)) continue;
    out = out.split(secret).join("[redacted]");
  }
  return out
    .replace(/\bBearer\s+[A-Za-z0-9._\-+/=]{8,}/gi, "Bearer [redacted]")
    .replace(/\b(sk|pk)_(?:test|live)_[A-Za-z0-9]+/g, "[redacted]");
}

export function redactUnknown(value: unknown): unknown {
  if (typeof value === "string") return redactSecrets(value);
  if (Array.isArray(value)) return value.map((entry) => redactUnknown(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [redactSecrets(key), redactUnknown(entry)]));
  }
  return value;
}
