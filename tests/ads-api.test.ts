import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { GET as oauthCallback } from "../app/api/ads/oauth/callback/route";
import { POST as oauthStart } from "../app/api/ads/oauth/start/route";
import { GET as searchTermsRoute } from "../app/api/ads/search-terms/route";
import { AdsApiError, amazonApply, assertSafeCall, clearTokenCache } from "../lib/ads/amazon";
import { signSession, GATE_COOKIE } from "../lib/ads/password-gate";
import { parseAction, screenText } from "../lib/ads/policy";
import { planMessage } from "../lib/ads/planner";
import {
  allowedRedirectUri,
  DOCUMENTED_REDIRECT_URI,
  setupKeyMatches,
  signOauthState,
  verifyOauthState,
} from "../lib/ads/oauth";
import { clearSearchTermJobs, loadSearchTerms } from "../lib/ads/search-terms";
import { seedCampaigns } from "../lib/ads/seed";
import { confirmProposal, proposeAction, recordFeedback, workspace } from "../lib/ads/service";
import { resetForTests } from "../lib/ads/store";

process.env.ADS_PORTAL_STATE_FILE = path.join(mkdtempSync(path.join(tmpdir(), "sot-ads-api-")), "state.json");

const actor = { id: "consultant-1", label: "Offshore consultant" };

function bet(intent = "Raise the daily budget on the Mermaid dough kit and hold efficiency while orders continue.") {
  return {
    intent,
    expectedSpend: 40,
    expectedAcos: 25,
    expectedTacos: 12,
    expectedOrders: 6,
    timelineDays: 14,
  };
}
const SECRET = "unit-secret-value";

function clearAmazonEnv() {
  delete process.env.AMAZON_ADS_CLIENT_ID;
  delete process.env.AMAZON_ADS_CLIENT_SECRET;
  delete process.env.AMAZON_ADS_REFRESH_TOKEN;
  delete process.env.AMAZON_ADS_PROFILE_ID;
  delete process.env.AMAZON_ADS_REGION;
  delete process.env.AMAZON_ADS_REDIRECT_URI;
  delete process.env.ADS_MAX_DAILY_BUDGET;
  delete process.env.ADS_MAX_BID;
  delete process.env.ADS_OAUTH_SETUP_KEY;
  delete process.env.ADS_PORTAL_PASSWORD;
  clearTokenCache();
  clearSearchTermJobs();
}

beforeEach(() => {
  clearAmazonEnv();
  resetForTests();
});

afterEach(() => {
  clearAmazonEnv();
});

test("kits group the sample catalog and a write cannot confirm without a bet", async () => {
  const view = await workspace(actor);
  const mermaid = view.kits.find((kit) => kit.kitId === "mermaid");
  const farm = view.kits.find((kit) => kit.kitId === "farm");
  assert.ok(mermaid);
  assert.ok(farm);
  assert.deepEqual(
    mermaid!.campaigns.map((campaign) => campaign.campaignId).sort(),
    ["sim-cmp-auto", "sim-cmp-brand"],
  );
  assert.deepEqual(farm!.campaigns.map((campaign) => campaign.campaignId), ["sim-cmp-chews"]);
  assert.equal(view.checks.length, 0);

  const proposed = await proposeAction(actor, { type: "set_budget", campaignId: "sim-cmp-brand", dailyBudget: 28 });
  assert.equal(proposed.ok, true);
  if (!proposed.ok) return;
  const missing = await confirmProposal(actor, proposed.proposal.id);
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.status, 400);
  const thinBody = {
    intent: "Adjust Mermaid dough a bit today",
    expectedSpend: 28,
    expectedAcos: 30,
    expectedOrders: 4,
    timelineDays: 3,
  };
  const thin = await confirmProposal(actor, proposed.proposal.id, thinBody);
  assert.equal(thin.ok, false);
  if (!thin.ok) assert.equal(thin.status, 409);
  assert.equal((await workspace(actor)).campaigns.find((campaign) => campaign.campaignId === "sim-cmp-brand")?.dailyBudget, 35);

  const confirmed = await confirmProposal(actor, proposed.proposal.id, {
    ...thinBody,
    defense: "Brand queries on Mermaid dough still convert, so this short clock is the case.",
  });
  assert.equal(confirmed.ok, true);
  if (!confirmed.ok) return;
  assert.equal(confirmed.proposal.challenge?.strength, "thin");
  const after = await workspace(actor);
  assert.equal(after.campaigns.find((campaign) => campaign.campaignId === "sim-cmp-brand")?.dailyBudget, 28);
  assert.equal(after.checks.length, 1);
  assert.equal(after.checks[0]?.kitName, "Mermaid dough kit");
  assert.equal(after.checks[0]?.status, "awaiting");
  assert.match(after.audit[0]?.intent || "", /Mermaid dough/);

  const recorded = await recordFeedback(actor, {
    id: after.checks[0]!.id,
    spend: 20,
    acos: 22,
    tacos: 10,
    orders: 7,
    note: "Sample window stayed inside the Mermaid bet.",
  });
  assert.equal(recorded.ok, true);
  if (!recorded.ok) return;
  assert.equal(recorded.check.comparison?.verdict, "met");
  assert.equal(recorded.check.comparison?.stub, true);
  const again = await recordFeedback(actor, {
    id: after.checks[0]!.id,
    spend: 20,
    orders: 7,
    note: "Sample window stayed inside the Mermaid bet.",
  });
  assert.equal(again.ok, false);
});

test("dry-run search terms are labeled sample and say API not connected", async () => {
  const report = await loadSearchTerms();
  assert.equal(report.connected, false);
  assert.equal(report.label, "API not connected");
  assert.equal(report.sample, true);
  assert.ok(report.rows.length >= 2);
  assert.equal(report.rows.every((row) => row.sample), true);
  assert.equal(JSON.stringify(report).includes("access_token"), false);

  process.env.ADS_PORTAL_PASSWORD = "unit-test-password";
  const request = new Request("http://127.0.0.1/api/ads/search-terms", {
    headers: { cookie: `${GATE_COOKIE}=${signSession()}` },
  });
  const response = await searchTermsRoute(request);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.label, "API not connected");
  assert.equal(body.sample, true);
});

test("workspace does not pretend the sample account is live", async () => {
  const view = await workspace(actor);
  assert.equal(view.connectionLabel, "API not connected");
  assert.equal(view.sampleData, true);
  assert.equal(view.campaigns.every((campaign) => campaign.simulated), true);
  const blob = JSON.stringify(view);
  assert.equal(blob.includes("access_token"), false);
  assert.equal(blob.includes("refresh_token"), false);
  assert.equal(blob.includes(SECRET), false);
});

test("archive, Helium Manage, and over-cap writes are refused before confirm", async () => {
  assert.equal(screenText("Helium 10 research for sensory chew"), null);
  assert.match(screenText("use Helium 10 Manage to push a listing")?.message || "", /analysis only|Helium 10 Manage/);
  const archived = parseAction({ type: "set_campaign_state", campaignIds: ["sim-cmp-brand"], state: "ARCHIVED" });
  assert.equal(archived.ok, false);
  if (!archived.ok) assert.equal(archived.status, 403);

  process.env.ADS_MAX_DAILY_BUDGET = "30";
  process.env.ADS_MAX_BID = "1";
  const budget = await proposeAction(actor, { type: "set_budget", campaignId: "sim-cmp-brand", dailyBudget: 40 });
  assert.equal(budget.ok, false);
  if (!budget.ok) assert.match(budget.error, /server cap/);
  const bid = await proposeAction(actor, {
    type: "update_keyword",
    campaignId: "sim-cmp-brand",
    keywordId: "sim-kw-brand-1",
    bid: 1.5,
  });
  assert.equal(bid.ok, false);
  const brand = (await workspace(actor)).campaigns.find((campaign) => campaign.campaignId === "sim-cmp-brand");
  assert.equal(brand?.dailyBudget, 35);
  assert.equal(brand?.keywords.find((keyword) => keyword.keywordId === "sim-kw-brand-1")?.bid, 1.4);
});

test("live budget writes stay blocked until the server cap is set", async () => {
  process.env.AMAZON_ADS_CLIENT_ID = "amzn1.application-oa2-client.example";
  process.env.AMAZON_ADS_CLIENT_SECRET = SECRET;
  process.env.AMAZON_ADS_REFRESH_TOKEN = "Atzr|refresh-token-value";
  process.env.AMAZON_ADS_PROFILE_ID = "1234567890";
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  try {
    const blocked = await proposeAction(actor, { type: "set_budget", campaignId: "sim-cmp-brand", dailyBudget: 10 });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.match(blocked.error, /ADS_MAX_DAILY_BUDGET/);
      assert.equal(blocked.error.includes(SECRET), false);
      assert.equal(blocked.error.includes("Atzr|"), false);
    }
  } finally {
    globalThis.fetch = original;
  }
});

test("negative, search term, and product ad confirms change only the sample store", async () => {
  const negative = await proposeAction(actor, {
    type: "add_negative",
    campaignId: "sim-cmp-brand",
    scope: "CAMPAIGN",
    kind: "KEYWORD",
    keywordText: "cheap",
    matchType: "NEGATIVE_EXACT",
    state: "ENABLED",
  });
  assert.equal(negative.ok, true);
  if (!negative.ok) return;
  assert.equal(
    (await workspace(actor)).campaigns.find((campaign) => campaign.campaignId === "sim-cmp-brand")?.negatives.some((entry) => entry.value === "cheap"),
    false,
  );
  const confirmed = await confirmProposal(actor, negative.proposal.id, bet());
  assert.equal(confirmed.ok, true);
  if (!confirmed.ok) return;
  assert.match(confirmed.proposal.result?.summary || "", /API not connected/);
  const after = (await workspace(actor)).campaigns.find((campaign) => campaign.campaignId === "sim-cmp-brand");
  assert.equal(after?.negatives.some((entry) => entry.value === "cheap" && entry.scope === "CAMPAIGN"), true);

  const bidPlan = planMessage("set bid of sensationally ot on SOT Brand Defense to $1.10", seedCampaigns());
  assert.equal(bidPlan.kind, "proposal");
  const term = planMessage("show search terms", seedCampaigns());
  assert.equal(term.kind, "reply");
  if (term.kind === "reply") assert.match(term.message, /API not connected/);

  const ad = await proposeAction(actor, {
    type: "manage_product_ad",
    campaignId: "sim-cmp-brand",
    asin: "B0NEWAD123",
    state: "PAUSED",
  });
  assert.equal(ad.ok, true);
  if (!ad.ok) return;
  await confirmProposal(actor, ad.proposal.id, bet());
  const ads = (await workspace(actor)).campaigns.find((campaign) => campaign.campaignId === "sim-cmp-brand")?.productAds;
  assert.equal(ads?.some((item) => item.asin === "B0NEWAD123" && item.state === "PAUSED"), true);
});

test("Sponsored Products client sends a negative keyword and never returns the access token", async () => {
  process.env.AMAZON_ADS_CLIENT_ID = "amzn1.application-oa2-client.example";
  process.env.AMAZON_ADS_CLIENT_SECRET = SECRET;
  process.env.AMAZON_ADS_REFRESH_TOKEN = "Atzr|refresh-token-value";
  process.env.AMAZON_ADS_PROFILE_ID = "1234567890";
  process.env.ADS_MAX_BID = "3";
  const calls: { url: string; body: string; authorization: string }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({ url, body: String(init?.body ?? ""), authorization: headers.get("authorization") || "" });
    if (url.includes("/auth/o2/token")) {
      return Response.json({ access_token: "Atza|should-not-leak", expires_in: 3600 });
    }
    if (url.endsWith("/sp/negativeKeywords")) {
      return Response.json({ negativeKeywords: { success: [{ keywordId: "nk1" }], error: [] } });
    }
    return Response.json({});
  };
  const applied = await amazonApply(
    {
      type: "add_negative",
      campaignId: "cmp-1",
      adGroupId: "ag-1",
      scope: "AD_GROUP",
      kind: "KEYWORD",
      keywordText: "cheap",
      matchType: "NEGATIVE_EXACT",
      state: "ENABLED",
    },
    { fetchImpl },
  );
  assert.match(applied.summary, /cheap/);
  const negativeCall = calls.find((call) => call.url.endsWith("/sp/negativeKeywords"));
  assert.ok(negativeCall);
  assert.match(negativeCall!.body, /NEGATIVE_EXACT/);
  assert.equal(JSON.stringify(applied).includes("should-not-leak"), false);
  assert.equal(JSON.stringify(applied).includes(SECRET), false);
  assert.match(negativeCall!.authorization, /Bearer Atza\|should-not-leak/);
  assert.throws(() => assertSafeCall({ method: "POST", path: "/sp/campaigns/delete", media: "application/json" }), AdsApiError);
  assert.throws(() => assertSafeCall({ method: "POST", path: "/sb/campaigns", media: "application/json" }), AdsApiError);
  assert.throws(() => assertSafeCall({ method: "GET", path: "/reporting/reports/bad", media: "application/json" }), AdsApiError);
  assert.doesNotThrow(() =>
    assertSafeCall({ method: "GET", path: "/reporting/reports/abc12345-report", media: "application/json" }),
  );
});

test("owner OAuth state is signed and the callback does not echo the client secret", async () => {
  process.env.AMAZON_ADS_CLIENT_ID = "amzn1.application-oa2-client.example";
  process.env.AMAZON_ADS_CLIENT_SECRET = SECRET;
  process.env.ADS_OAUTH_SETUP_KEY = "owner-setup-key";
  process.env.AMAZON_ADS_REGION = "na";
  process.env.ADS_PORTAL_PASSWORD = "unit-test-password";
  assert.equal(DOCUMENTED_REDIRECT_URI, "https://fde-hello.vercel.app/api/ads/oauth/callback");
  assert.equal(allowedRedirectUri(DOCUMENTED_REDIRECT_URI), DOCUMENTED_REDIRECT_URI);
  assert.equal(allowedRedirectUri("https://evil.example/api/ads/oauth/callback"), null);
  assert.equal(allowedRedirectUri("http://localhost:3000/api/ads/oauth/callback"), "http://localhost:3000/api/ads/oauth/callback");
  assert.equal(setupKeyMatches("owner-setup-key"), true);
  assert.equal(setupKeyMatches("consultant-password"), false);
  const state = signOauthState();
  assert.ok(state);
  assert.equal(verifyOauthState(state), true);
  assert.equal(verifyOauthState(`${state}x`), false);

  const cookie = `${GATE_COOKIE}=${signSession()}`;
  const missing = await oauthStart(
    new Request("https://fde-hello.vercel.app/api/ads/oauth/start", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ setupKey: "consultant-password" }),
    }),
  );
  assert.equal(missing.status, 403);
  const started = await oauthStart(
    new Request("https://fde-hello.vercel.app/api/ads/oauth/start", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ setupKey: "owner-setup-key" }),
    }),
  );
  const startedBody = await started.json();
  assert.equal(started.status, 200);
  assert.match(startedBody.authorizeUrl, /^https:\/\/www\.amazon\.com\/ap\/oa\?/);
  assert.equal(startedBody.authorizeUrl.includes(SECRET), false);
  const authorize = new URL(startedBody.authorizeUrl);
  assert.equal(authorize.searchParams.get("redirect_uri"), DOCUMENTED_REDIRECT_URI);

  const bad = await oauthCallback(
    new Request(`https://fde-hello.vercel.app/api/ads/oauth/callback?code=abc&state=nope`, { headers: { cookie } }),
  );
  const badHtml = await bad.text();
  assert.equal(bad.status, 403);
  assert.equal(badHtml.includes(SECRET), false);
  assert.equal(badHtml.includes("Atzr|"), false);

  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/auth/o2/token")) {
      return Response.json({ refresh_token: "Atzr|owner-refresh", access_token: "Atza|access" });
    }
    if (url.endsWith("/v2/profiles")) {
      return Response.json([
        { profileId: "999", countryCode: "US", accountInfo: { name: "Sensationally OT", type: "seller" } },
      ]);
    }
    return new Response("no", { status: 404 });
  };
  try {
    const ok = await oauthCallback(
      new Request(`https://fde-hello.vercel.app/api/ads/oauth/callback?code=one-time&state=${encodeURIComponent(state!)}`, {
        headers: { cookie },
      }),
    );
    const page = await ok.text();
    assert.equal(ok.status, 200);
    assert.match(page, /Atzr\|owner-refresh/);
    assert.match(page, /999/);
    assert.equal(page.includes(SECRET), false);
    assert.match(page, /not the consultant desk/i);
  } finally {
    globalThis.fetch = original;
  }
});
