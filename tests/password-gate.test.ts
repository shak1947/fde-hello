import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { POST as login } from "../app/api/ads/login/route";
import { POST as logout } from "../app/api/ads/logout/route";
import { actorFromRequest } from "../lib/ads/auth";
import { GATE_COOKIE, passwordsMatch, signSession, verifySession } from "../lib/ads/password-gate";
import { proxy } from "../proxy";

const DUMMY = "unit-test-password";

function loginRequest(password: string, url = "http://127.0.0.1/api/ads/login") {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
}

function cookiePair(setCookie: string | null): string {
  const first = (setCookie || "").split(";")[0] || "";
  assert.match(first, new RegExp(`^${GATE_COOKIE}=.+`));
  return first;
}

test("missing portal password fails closed", async () => {
  delete process.env.ADS_PORTAL_PASSWORD;
  assert.equal(passwordsMatch(DUMMY), false);
  assert.equal(signSession(), null);
  const response = await login(loginRequest(DUMMY));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("set-cookie"), null);
  const body = await response.json();
  assert.equal(body.error, "Portal password is not configured.");
});

test("wrong password is rejected and a match sets an httpOnly cookie", async () => {
  process.env.ADS_PORTAL_PASSWORD = DUMMY;
  try {
    const wrong = await login(loginRequest("not-the-password"));
    assert.equal(wrong.status, 401);
    const wrongBody = await wrong.json();
    assert.equal(wrongBody.error, "Wrong password.");
    assert.equal(wrong.headers.get("set-cookie"), null);
    assert.equal(JSON.stringify(wrongBody).includes(DUMMY), false);

    const right = await login(loginRequest(DUMMY));
    assert.equal(right.status, 200);
    const setCookie = right.headers.get("set-cookie") || "";
    assert.match(setCookie, /HttpOnly/i);
    assert.doesNotMatch(setCookie, /Secure/i);
    assert.equal(setCookie.includes(DUMMY), false);
    const token = cookiePair(setCookie).slice(GATE_COOKIE.length + 1);
    assert.equal(verifySession(token), true);
    assert.equal(verifySession(`${token}x`), false);
    assert.equal(verifySession(token, Date.now() + 13 * 60 * 60 * 1000), false);

    const actor = await actorFromRequest(
      new Request("http://127.0.0.1/api/ads/workspace", { headers: { cookie: `${GATE_COOKIE}=${token}` } }),
    );
    assert.equal(actor?.label, "Shared password");
    assert.equal(await actorFromRequest(new Request("http://127.0.0.1/api/ads/workspace")), null);

    const page = await proxy(new NextRequest("http://127.0.0.1/ads"));
    assert.equal(page.status, 307);
    assert.match(page.headers.get("location") || "", /\/ads\/enter$/);

    const api = await proxy(new NextRequest("http://127.0.0.1/api/ads/workspace"));
    assert.equal(api.status, 401);

    const open = await proxy(
      new NextRequest("http://127.0.0.1/ads", { headers: { cookie: `${GATE_COOKIE}=${token}` } }),
    );
    assert.equal(open.headers.get("x-middleware-next"), "1");
    assert.equal(open.status, 200);

    const home = await proxy(new NextRequest("http://127.0.0.1/"));
    assert.match(home.headers.get("x-middleware-rewrite") || "", /legacy-home\.html/);

    const adsHost = await proxy(new NextRequest("http://ads.sensationallyot.com/"));
    assert.equal(adsHost.status, 307);
    assert.match(adsHost.headers.get("location") || "", /\/ads\/enter$/);

    const secure = await login(loginRequest(DUMMY, "https://fde-hello.vercel.app/api/ads/login"));
    assert.match(secure.headers.get("set-cookie") || "", /Secure/i);

    const signedOut = await logout(new Request("http://127.0.0.1/api/ads/logout", { method: "POST" }));
    assert.match(signedOut.headers.get("set-cookie") || "", /Max-Age=0/i);
  } finally {
    delete process.env.ADS_PORTAL_PASSWORD;
  }
});

test("comparison keeps punctuation and does not trim", () => {
  process.env.ADS_PORTAL_PASSWORD = "keep-bang!";
  try {
    assert.equal(passwordsMatch("keep-bang!"), true);
    assert.equal(passwordsMatch("keep-bang"), false);
    assert.equal(passwordsMatch("keep-bang! "), false);
  } finally {
    delete process.env.ADS_PORTAL_PASSWORD;
  }
});

test("dev bypass still needs the password cookie when the password is set", async () => {
  process.env.ADS_PORTAL_PASSWORD = DUMMY;
  process.env.ADS_PORTAL_DEV_BYPASS = "1";
  delete process.env.VERCEL;
  try {
    const token = signSession();
    assert.ok(token);
    const withoutCookie = await actorFromRequest(
      new Request("http://127.0.0.1/api/ads/workspace", { headers: { authorization: "Bearer dev" } }),
    );
    assert.equal(withoutCookie, null);
    const withCookie = await actorFromRequest(
      new Request("http://127.0.0.1/api/ads/workspace", {
        headers: { authorization: "Bearer dev", cookie: `${GATE_COOKIE}=${token}` },
      }),
    );
    assert.equal(withCookie?.id, "local-dev");
  } finally {
    delete process.env.ADS_PORTAL_PASSWORD;
    delete process.env.ADS_PORTAL_DEV_BYPASS;
  }
});

test("client portal source does not read the portal password", () => {
  const form = readFileSync(new URL("../app/ads/enter/form.tsx", import.meta.url), "utf8");
  const portal = readFileSync(new URL("../app/ads/ui/portal.tsx", import.meta.url), "utf8");
  assert.equal(form.includes("ADS_PORTAL_PASSWORD"), false);
  assert.equal(portal.includes("ADS_PORTAL_PASSWORD"), false);
  assert.equal(form.includes(DUMMY), false);
});
