import { isActor, requireActor } from "@/lib/ads/http";
import { amazonEnv } from "@/lib/ads/mode";
import { buildAuthorizeUrl, oauthSetupConfigured, redirectUriFromRequest, setupKeyMatches, signOauthState } from "@/lib/ads/oauth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await requireActor(request);
  if (!isActor(actor)) return actor;
  const body = (await request.json().catch(() => null)) as { setupKey?: unknown } | null;
  const setupKey = typeof body?.setupKey === "string" ? body.setupKey : "";
  if (!oauthSetupConfigured()) {
    return Response.json({ error: "Owner setup key is not configured." }, { status: 503 });
  }
  if (!setupKeyMatches(setupKey)) {
    return Response.json({ error: "Owner setup key was not accepted." }, { status: 403 });
  }
  const env = amazonEnv();
  if (!env.clientId || !env.clientSecret) {
    return Response.json(
      { error: "API not connected. Set the Amazon Ads client id and secret on the server before the owner grant." },
      { status: 409 },
    );
  }
  const redirectUri = redirectUriFromRequest(request);
  if (!redirectUri) {
    return Response.json({ error: "Redirect host is not allowed for the Amazon grant." }, { status: 400 });
  }
  const state = signOauthState();
  if (!state) return Response.json({ error: "Owner grant could not be started." }, { status: 503 });
  return Response.json({ authorizeUrl: buildAuthorizeUrl(redirectUri, state) });
}
