import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { devBypassEnabled } from "./mode";
import { passwordConfigured, readCookie, verifySession } from "./password-gate";
import type { Actor } from "./types";

export const DEFAULT_CLERK_PUBLISHABLE_KEY =
  "pk_test_b3JnYW5pYy10dXJrZXktMjkxMy5jbGVyay5hY2NvdW50cy5kZXYk";

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export function publishableKey(): string {
  return (
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ||
    process.env.CLERK_PUBLISHABLE_KEY?.trim() ||
    DEFAULT_CLERK_PUBLISHABLE_KEY
  );
}

export function clerkFrontendApi(key = publishableKey()): string {
  const match = key.match(/^pk_(test|live)_(.+)$/);
  if (!match) throw new Error("Clerk publishable key is not in the expected form.");
  const encoded = match[2];
  const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4);
  const host = Buffer.from(padded, "base64").toString("utf8").replace(/\$$/, "");
  if (!host.includes("clerk.")) throw new Error("Clerk publishable key did not decode to a Clerk host.");
  return `https://${host}`;
}

export function clerkBrowserScript(key = publishableKey()): string {
  return `${clerkFrontendApi(key)}/npm/@clerk/clerk-js@5/dist/clerk.browser.js`;
}

type VerifyDeps = {
  issuer?: string;
  jwks?: ReturnType<typeof createRemoteJWKSet> | Parameters<typeof jwtVerify>[1];
};

export async function verifySessionToken(token: string, deps: VerifyDeps = {}): Promise<JWTPayload> {
  const issuer = deps.issuer ?? clerkFrontendApi();
  const jwks =
    deps.jwks ??
    jwksCache.get(issuer) ??
    jwksCache.set(issuer, createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))).get(issuer)!;
  const { payload } = await jwtVerify(token, jwks, { issuer });
  if (!payload.sub) throw new Error("Session token has no subject.");
  return payload;
}

export async function actorFromRequest(request: Request): Promise<Actor | null> {
  const header = request.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const cookieOk = verifySession(readCookie(request.headers.get("cookie")));
  if (token === "dev" && devBypassEnabled()) {
    if (passwordConfigured() && !cookieOk) return null;
    return { id: "local-dev", label: "Local dev bypass" };
  }
  if (!passwordConfigured() || !cookieOk) return null;
  if (token) {
    try {
      const payload = await verifySessionToken(token);
      const userId = String(payload.sub);
      const email = await resolveEmail(userId, payload);
      const allow = allowedEmails();
      if (allow.length && (!email || !allow.includes(email.toLowerCase()))) {
        return { id: "shared-gate", label: "Shared password" };
      }
      return { id: userId, label: email || `Clerk ${userId}` };
    } catch {
      return { id: "shared-gate", label: "Shared password" };
    }
  }
  return { id: "shared-gate", label: "Shared password" };
}

function allowedEmails(): string[] {
  return (process.env.ADS_PORTAL_ALLOWED_EMAILS || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

async function resolveEmail(userId: string, payload: JWTPayload): Promise<string | null> {
  const claimed = payload.email || payload.primary_email_address;
  if (typeof claimed === "string" && claimed.includes("@")) return claimed;
  const secret = process.env.CLERK_SECRET_KEY?.trim();
  if (!secret) return null;
  const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    email_addresses?: { id: string; email_address: string }[];
    primary_email_address_id?: string;
  };
  const primary = body.email_addresses?.find((entry) => entry.id === body.primary_email_address_id);
  return primary?.email_address || body.email_addresses?.[0]?.email_address || null;
}
