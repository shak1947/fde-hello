import { isActor, requireActor } from "@/lib/ads/http";
import {
  escapeHtml,
  exchangeAuthCode,
  listProfiles,
  ownerGrantHtml,
  redirectUriFromRequest,
  safeOauthError,
  verifyOauthState,
} from "@/lib/ads/oauth";

export const dynamic = "force-dynamic";

function html(message: string, status: number) {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Amazon Ads grant</title></head><body style="font-family:sans-serif;background:#0b1020;color:#e8eefc;padding:2rem"><p>${escapeHtml(message)}</p><p><a href="/ads/connect">Back to connect</a></p></body></html>`;
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function GET(request: Request) {
  const actor = await requireActor(request);
  if (!isActor(actor)) return actor;
  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return html("Amazon did not complete the grant. No token was stored.", 400);
  }
  if (!verifyOauthState(url.searchParams.get("state"))) {
    return html("This grant link is not valid. Start again from Connect Ads API. No token was stored.", 403);
  }
  const code = url.searchParams.get("code") || "";
  const redirectUri = redirectUriFromRequest(request);
  if (!redirectUri || !code) {
    return html("The grant callback is missing a code or an allowed redirect. No token was stored.", 400);
  }
  try {
    const tokens = await exchangeAuthCode(code, redirectUri);
    let profiles: Awaited<ReturnType<typeof listProfiles>> = [];
    let profileError = "";
    try {
      profiles = await listProfiles(tokens.accessToken);
    } catch {
      profileError = "Profile list failed. The refresh token is below. Credentials stay on the server.";
    }
    return new Response(ownerGrantHtml({ refreshToken: tokens.refreshToken, profiles, profileError }), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    return html(safeOauthError(error), 502);
  }
}
