import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const GATE_COOKIE = "sot_ads_gate";
const MAX_AGE_SECONDS = 12 * 60 * 60;

export function passwordConfigured(): boolean {
  return Boolean(process.env.ADS_PORTAL_PASSWORD);
}

export function passwordsMatch(input: string): boolean {
  const expected = process.env.ADS_PORTAL_PASSWORD;
  if (!expected || typeof input !== "string") return false;
  const actualHash = createHash("sha256").update(input, "utf8").digest();
  const expectedHash = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(actualHash, expectedHash);
}

function macKey(): Buffer | null {
  const expected = process.env.ADS_PORTAL_PASSWORD;
  if (!expected) return null;
  return createHash("sha256").update(`sot-ads-gate:${expected}`, "utf8").digest();
}

export function signSession(now = Date.now()): string | null {
  const key = macKey();
  if (!key) return null;
  const body = Buffer.from(JSON.stringify({ exp: now + MAX_AGE_SECONDS * 1000, v: 1 })).toString("base64url");
  const mac = createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifySession(token: string | null | undefined, now = Date.now()): boolean {
  const key = macKey();
  if (!key || !token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac("sha256", key).update(body).digest("base64url");
  const actualBuf = Buffer.from(mac);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { exp?: unknown };
    return typeof parsed.exp === "number" && parsed.exp > now;
  } catch {
    return false;
  }
}

export function readCookie(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    if (name === GATE_COOKIE) return part.slice(separator + 1).trim();
  }
  return null;
}

export function requestIsSecure(request: { headers: Headers; url: string }): boolean {
  const proto = request.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0]?.trim() === "https";
  return new URL(request.url).protocol === "https:";
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
