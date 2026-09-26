import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { amazonEnv } from "./mode";
import { redactSecrets } from "./redact";

const PRODUCTION_CALLBACK = "https://fde-hello.vercel.app/api/ads/oauth/callback";
const STATE_TTL_MS = 15 * 60 * 1000;

export type OauthProfile = {
  profileId: string;
  countryCode: string;
  accountName: string;
  accountType: string;
};

export function oauthSetupConfigured(): boolean {
  const key = process.env.ADS_OAUTH_SETUP_KEY;
  return Boolean(key && key.length >= 8);
}

export function setupKeyMatches(input: string): boolean {
  const expected = process.env.ADS_OAUTH_SETUP_KEY;
  if (!expected || expected.length < 8 || typeof input !== "string") return false;
  const actualHash = createHash("sha256").update(input, "utf8").digest();
  const expectedHash = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(actualHash, expectedHash);
}

function stateSecret(): string | null {
  const env = amazonEnv();
  const setup = process.env.ADS_OAUTH_SETUP_KEY;
  if (!env.clientSecret || !setup) return null;
  return createHash("sha256").update(`sot-ads-oauth:${env.clientSecret}:${setup}`, "utf8").digest("base64url");
}

export function signOauthState(now = Date.now()): string | null {
  const secret = stateSecret();
  if (!secret) return null;
  const env = amazonEnv();
  const body = Buffer.from(JSON.stringify({ exp: now + STATE_TTL_MS, region: env.region, v: 1 })).toString("base64url");
  const mac = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyOauthState(token: string | null | undefined, now = Date.now()): boolean {
  const secret = stateSecret();
  if (!secret || !token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const actualBuf = Buffer.from(mac);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { exp?: unknown; region?: unknown };
    return typeof parsed.exp === "number" && parsed.exp > now && parsed.region === amazonEnv().region;
  } catch {
    return false;
  }
}

export function allowedRedirectUri(candidate: string): string | null {
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.pathname !== "/api/ads/oauth/callback") return null;
  const host = url.hostname.toLowerCase();
  const local = host === "localhost" || host === "127.0.0.1";
  if (local) {
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin + url.pathname;
  }
  if (url.protocol !== "https:") return null;
  const preview = host.endsWith(".vercel.app") && host.includes("fde-hello");
  if (host !== "fde-hello.vercel.app" && !preview) return null;
  return url.origin + url.pathname;
}

export function redirectUriFromRequest(request: Request): string | null {
  const configured = process.env.AMAZON_ADS_REDIRECT_URI?.trim();
  if (configured) return allowedRedirectUri(configured);
  const url = new URL(request.url);
  const proto = (request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "")).split(",")[0].trim();
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host).split(",")[0].trim();
  return allowedRedirectUri(`${proto}://${host}/api/ads/oauth/callback`);
}

export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const env = amazonEnv();
  const url = new URL(env.authorizeUrl);
  url.searchParams.set("client_id", env.clientId);
  url.searchParams.set("scope", "advertising::campaign_management");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeAuthCode(
  code: string,
  redirectUri: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ refreshToken: string; accessToken: string }> {
  const env = amazonEnv();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: env.clientId,
    client_secret: env.clientSecret,
  });
  const response = await fetchImpl(env.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    refresh_token?: string;
    access_token?: string;
  };
  if (!response.ok || !payload.refresh_token || !payload.access_token) {
    throw new Error("Amazon did not return a refresh token. Credentials stay on the server.");
  }
  return { refreshToken: payload.refresh_token, accessToken: payload.access_token };
}

export async function listProfiles(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OauthProfile[]> {
  const env = amazonEnv();
  const response = await fetchImpl(`${env.apiBase}/v2/profiles`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Amazon-Advertising-API-ClientId": env.clientId,
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return [];
  const payload = (await response.json().catch(() => [])) as unknown;
  if (!Array.isArray(payload)) return [];
  return payload.slice(0, 30).map((row) => {
    const record = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const account = record.accountInfo && typeof record.accountInfo === "object" ? (record.accountInfo as Record<string, unknown>) : {};
    return {
      profileId: String(record.profileId ?? ""),
      countryCode: String(record.countryCode ?? ""),
      accountName: String(account.name ?? ""),
      accountType: String(account.type ?? ""),
    };
  }).filter((profile) => profile.profileId);
}

export function ownerGrantHtml(input: {
  refreshToken: string;
  profiles: OauthProfile[];
  profileError: string;
}): string {
  const profiles = input.profiles.length
    ? `<table><thead><tr><th>Profile id</th><th>Country</th><th>Account</th><th>Type</th></tr></thead><tbody>${input.profiles
        .map(
          (profile) =>
            `<tr><td><code>${escapeHtml(profile.profileId)}</code></td><td>${escapeHtml(profile.countryCode)}</td><td>${escapeHtml(profile.accountName)}</td><td>${escapeHtml(profile.accountType)}</td></tr>`,
        )
        .join("")}</tbody></table>`
    : `<p>${escapeHtml(input.profileError || "No advertising profiles were returned. Copy the profile id from the Amazon Ads console.")}</p>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="robots" content="noindex" />
  <title>Amazon Ads grant</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; background: #0b1020; color: #e8eefc; margin: 0; }
    main { max-width: 760px; margin: 2rem auto; padding: 1.2rem; }
    textarea { width: 100%; min-height: 7rem; background: #0b1020; color: #e8eefc; border: 1px solid #2a3555; border-radius: 10px; padding: 0.6rem; }
    table { width: 100%; border-collapse: collapse; }
    td, th { text-align: left; padding: 0.4rem; border-bottom: 1px solid #2a3555; }
    a { color: #7aa2ff; }
    .warn { color: #fcd34d; }
  </style>
</head>
<body>
  <main>
    <p class="warn">Owner grant only. This is not the consultant desk. Do not send this page, or the token on it, to the consultant.</p>
    <h1>Paste the refresh token into Vercel</h1>
    <p>Copy the value into the Vercel environment variable <code>AMAZON_ADS_REFRESH_TOKEN</code> for project fde-hello, then close this tab. The consultant UI never receives this token.</p>
    <textarea readonly>${escapeHtml(input.refreshToken)}</textarea>
    <h2>Profile id</h2>
    <p>Copy the Sensationally OT profile id into <code>AMAZON_ADS_PROFILE_ID</code>. Redeploy after both values are saved. Also set <code>ADS_MAX_DAILY_BUDGET</code> and <code>ADS_MAX_BID</code> before live writes.</p>
    ${profiles}
    <p><a href="/ads/connect">Back to connect</a></p>
  </main>
</body>
</html>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function safeOauthError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Amazon grant failed.";
  return redactSecrets(message);
}

export const DOCUMENTED_REDIRECT_URI = PRODUCTION_CALLBACK;
