# Sensationally OT Amazon Ads portal

Invite-only desk for an offshore consultant on Shakeel Amir’s Sensationally OT account. Access is limited to **Amazon PPC**, **Sellerboard** analysis, and **Helium 10** analysis. The app is the Next.js project at the repository root. The portal is served at `/ads`.

Spend on ads is Shak’s. The catalog is two sensory kits: **Mermaid dough** (`KIT-MERMAID`, `B0CFT7YF1L`) and **Farm dough** (`35-ZREI-MJZW`, `B0GCTV28TN`). The desk groups campaigns under those kits. Shak does not manage performance in Amazon’s Ads console; this desk is the record for him and the offshore PPC manager.

Every create, budget change, keyword change, and on/off switch is prepared first. Confirm requires a bet: what is changing, expected spend, an ACoS or TACOS target, expected orders, and a timeline in days. A thin bet (no kit named, a vague intent, a window under 7 or over 45 days, or a loose efficiency target) is questioned and is stored only after the manager answers. The audit log keeps that bet. A later result check compares the bet with numbers entered on the desk. That comparison does not pull a live Amazon report yet. Sellerboard and Helium 10 stay read-only. The consultant never sees Shak’s passwords or API keys; those stay in server environment variables.

## What the consultant can do

- Kits: Mermaid dough and Farm dough, with the campaigns, budgets, and sample or live spend that sit on each ASIN
- Amazon PPC (Sponsored Products): list campaigns, keywords, negatives, product targets, and product ads
- Amazon PPC writes, each after Confirm, and each checked against server spend caps:
  1. Pause or enable a campaign
  2. Edit a campaign daily budget
  3. Edit a keyword bid, or pause or enable a keyword
  4. Add a keyword (exact, phrase, or broad)
  5. Add a negative keyword or negative ASIN, at campaign or ad group scope
  6. Read a search-term report and apply a row as a keyword or a negative
  7. Add or edit a product target, and add, pause, or enable a product ad ASIN
- Sellerboard: read sample profit analysis (not a live account change)
- Helium 10: read sample keyword research (not a live account change, and not Helium 10 Manage)
- Download CSV for campaigns, keywords, and the mutation audit log (the audit CSV includes the intent and expected outcome)

PPC reads run immediately. PPC writes become a pending card with the bet. Cancel drops the change. The audit log stores applied, cancelled, failed, and refused attempts, including the intent and the expected spend, ACoS or TACOS, orders, and timeline when a write was confirmed.

## Hard deny

Anything outside Amazon PPC, Sellerboard, and Helium 10 is refused with: “Access is limited to Amazon PPC, Sellerboard, and Helium 10.”

These are blocked in the chat text, in tool inputs, and again when someone confirms:

- Email, Gmail, and any mailbox
- Seller Central listings, orders, inventory, and FBA (Ads console campaign work stays allowed)
- Other Grok bots and internal platforms
- Passwords, API keys, tokens, and raw credentials
- Wipe or delete account history
- Archive, bulk delete, “delete everything”, or deleting a campaign, keyword, target, or product ad
- Billing, cards, payouts, invoices
- Writes to Sellerboard, Helium 10, or Helium 10 Manage
- Sponsored Brands and Sponsored Display (follow-up; the API refuses those paths)

There is no delete tool and no Amazon request path outside Sponsored Products campaign, ad group, and keyword list/create/update. The HTTP client rejects `DELETE`. Amazon error text returned to the desk does not include credential values.

Pausing a campaign is the supported way to stop spend. Pausing does not remove history.

## Why this is not an eve agent

eve is a durable general agent runtime: its tools run inside the agent loop, and the framework also carries channels, sandboxes, and subagents. This portal cannot expose that surface. The desk is a closed AI SDK tool list (`gateway()` + `generateText`) plus the same proposal API the forms use. Direct commands (“set budget of SOT Brand Defense to $40”) are handled without a model so the simulator works before a gateway key exists. On Vercel, unclear sentences can use the AI Gateway through OIDC. If the model call fails, the desk falls back to the command parser and changes nothing.

Allowed tool names:

- `list_campaigns`
- `list_keywords`
- `get_performance`
- `propose_create_campaign`
- `propose_update_campaign`
- `propose_set_budget`
- `propose_set_campaign_state`
- `propose_upsert_keywords`
- `propose_update_keyword`
- `propose_add_negative`
- `propose_apply_search_term`
- `propose_upsert_product_target`
- `propose_manage_product_ad`
- `list_search_terms` (read-only)
- `sellerboard_snapshot` (read-only analysis)
- `helium10_snapshot` (read-only analysis)

## API not connected

If client id, secret, refresh token, or profile id is missing, the banner says **API not connected**. Three sample campaigns (`SOT Brand Defense` and `SOT Auto Discovery` on Mermaid dough, `SOT Sensory Chews` on Farm dough), plus sample keywords, negatives, search terms, product targets, and product ads, stand in for the account. The product ads use the real listing ids so the kit grouping matches the catalog. Every sample row is labeled Sample. Spend figures are sample. Confirm updates that local state, the bet, and the audit log. It does not call Amazon, does not pretend the data is live, and does not spend money.

The in-process store is written to `/tmp/sot-ads-portal-state.json` (or `ADS_PORTAL_STATE_FILE`). On Vercel that file lives for the life of the instance, not across a fresh deploy. Connect the Ads API for a real account of record. The audit CSV is still the mutation trail for the running instance.

## Environment

Copy `.env.example` to `.env.local` for local work. In Vercel, add the same names to the existing **fde-hello** project (Production and Preview).

| Name | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend key. If unset, the portal uses the key already shipped with the fde-hello site (`organic-turkey-2913`). |
| `CLERK_SECRET_KEY` | Optional. Used to read the signed-in email when an allowlist is set. |
| `ADS_PORTAL_ALLOWED_EMAILS` | Optional comma-separated emails. Requires a secret key or an email claim on the session token. |
| `AMAZON_ADS_CLIENT_ID` | Login with Amazon client id |
| `AMAZON_ADS_CLIENT_SECRET` | Login with Amazon secret |
| `AMAZON_ADS_REFRESH_TOKEN` | Refresh token from Shak’s one-time grant. Never put this in the consultant UI or in git. |
| `AMAZON_ADS_PROFILE_ID` | Profile id sent as `Amazon-Advertising-API-Scope` |
| `AMAZON_ADS_REGION` | `na` (default), `eu`, or `fe` |
| `ADS_MAX_DAILY_BUDGET` | Optional in dry-run. Required before a live daily-budget write. Values above the cap are refused. |
| `ADS_MAX_BID` | Optional in dry-run. Required before a live bid write. Values above the cap are refused. |
| `ADS_OAUTH_SETUP_KEY` | Owner-only key, at least 8 characters. The shared portal password cannot start the Amazon grant. |
| `AMAZON_ADS_REDIRECT_URI` | Optional. Production value is `https://fde-hello.vercel.app/api/ads/oauth/callback`. |
| `AMAZON_ADS_API_BASE` | Optional host override |
| `AMAZON_ADS_TOKEN_URL` | Optional. Defaults: `na` `https://api.amazon.com/auth/o2/token`, `eu` `https://api.amazon.co.uk/auth/o2/token`, `fe` `https://api.amazon.co.jp/auth/o2/token` |
| `ADS_PORTAL_MODEL` | AI Gateway model. Default `openai/gpt-6-luna` |
| `AI_GATEWAY_API_KEY` | Only needed off Vercel. Deployed functions use OIDC. |
| `ADS_PORTAL_PASSWORD` | Shared password for the portal. Set it in Vercel → project **fde-hello** → Settings → Environment Variables for **Production** and **Preview**, then redeploy. The server compares the sign-in form to this value and sets an httpOnly session cookie. If the variable is missing, the portal stays closed. Do not commit the value. |
| `ADS_PORTAL_DEV_BYPASS` | Local API tests only. Value `1` accepts `Authorization: Bearer dev` when `VERCEL` is unset. Ignored on Vercel. The password cookie is still required when `ADS_PORTAL_PASSWORD` is set. |

Live mode turns on only when client id, secret, refresh token, and profile id are all set. The same confirm step still guards writes. Live budget and bid changes also require `ADS_MAX_DAILY_BUDGET` and `ADS_MAX_BID`. See `/ads/connect` in the running app.

The access token is refreshed on the server and is not returned to the browser. The audit log records portal writes (applied, cancelled, failed, refused) and is passed through redaction so passwords, refresh tokens, and access tokens are not stored.

Amazon writes use Sponsored Products v3 (`application/vnd.spCampaign.v3+json`, and the ad group, keyword, negative keyword, targeting clause, and product ad equivalents). Search terms use `POST /reporting/reports` with `reportTypeId` `spSearchTerm`. A new campaign is created with `LEGACY_FOR_SALES` bidding and a default ad group so keywords have somewhere to land. Sponsored Brands and Sponsored Display are not called.

## Login with Amazon (one-time owner grant)

Shak does this once. The consultant desk never receives the refresh token.

1. Create a Login with Amazon security profile and request Amazon Ads API access for scope `advertising::campaign_management`.
2. Allowed return URL for production: `https://fde-hello.vercel.app/api/ads/oauth/callback`. For local work also allow `http://localhost:3000/api/ads/oauth/callback`.
3. In Vercel → project **fde-hello** → Settings → Environment Variables, set `AMAZON_ADS_CLIENT_ID`, `AMAZON_ADS_CLIENT_SECRET`, `AMAZON_ADS_REGION` (`na`, `eu`, or `fe`), `ADS_OAUTH_SETUP_KEY`, `ADS_MAX_DAILY_BUDGET`, and `ADS_MAX_BID` for Production and Preview. Do not commit the values.
4. Redeploy.
5. Sign in at `/ads` with the portal password, open `/ads/connect`, and enter the owner setup key. The shared password alone returns 403.
6. Amazon redirects to the callback. Copy the refresh token into `AMAZON_ADS_REFRESH_TOKEN` and the Sensationally OT profile id into `AMAZON_ADS_PROFILE_ID`. Close the tab. Do not send that page to the consultant.
7. Redeploy. The desk banner changes from **API not connected** to **Live Ads API**. Writes still wait for Confirm.

## Login gate

The portal is closed until `ADS_PORTAL_PASSWORD` is set on the server.

1. Vercel → project **fde-hello** → Settings → Environment Variables.
2. Add `ADS_PORTAL_PASSWORD` for Production and Preview. Paste the password only in that Vercel field. Do not put it in git, this README, or logs.
3. Redeploy so the new variable is picked up.
4. Open `/ads`. The app redirects to `/ads/enter`.
5. A wrong password is rejected. A match sets an httpOnly session cookie (`sot_ads_gate`) and opens the desk. The password is not sent to the browser bundle.
6. Sign out clears the cookie. API routes under `/api/ads` (except login, logout, and health) return 401 without that cookie.

Clerk remains available as an extra invite list if you want it later: Restricted mode, invite the consultant, and allow the portal origins (`https://fde-hello.vercel.app`, the preview URL, and `https://ads.sensationallyot.com`). The shared password is enough for v1. A Clerk session does not open the desk without the password cookie.

The existing `/` bio keeps its own Clerk widget. `/eval` stays public.

## Subdomain

Goal: `https://ads.sensationallyot.com` opens this portal.

1. Vercel → project **fde-hello** → Settings → Domains → add `ads.sensationallyot.com`.
2. At the DNS host for `sensationallyot.com`:

   | Type | Name | Value |
   | --- | --- | --- |
   | CNAME | `ads` | `cname.vercel-dns.com` |

   If the domain already uses Vercel nameservers, adding the domain in the dashboard is enough and Vercel writes the record.
3. Wait until Vercel shows the domain as valid.
4. `proxy.ts` sends `/` on an `ads.*` host through the same password gate, then to the portal. Every other host still serves the John AI Smith page at `/` and the scorecard at `/eval`.
5. If you also use Clerk, add `https://ads.sensationallyot.com` to the allowed origins.

## Local

```bash
npm install
npm test
npm run dev
```

Open `http://localhost:3000/ads`. Set `ADS_PORTAL_PASSWORD` in `.env.local` (gitignored) to the same value you stored in Vercel, then sign in at `/ads/enter`. Without that variable the desk stays closed.

`npm test` covers the denylist, confirm-before-write, audit CSV, formula-safe CSV, Amazon path guard, Clerk token checks, and the password gate. The tests use a dummy password in the process environment only.

## Existing pages

`/` is `public/legacy-home.html` (rewrite). `/eval` is the product dossier in `eval/`, served by the Next route (stepping stones, stacking rocks, and the competitor tables). Do not put an `app/page.tsx` over `/`, or the bio gate will stop loading.
