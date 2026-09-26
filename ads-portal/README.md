# Sensationally OT Amazon Ads portal

Invite-only desk for an offshore consultant on Shakeel Amir’s Sensationally OT account. Access is limited to **Amazon PPC**, **Sellerboard** analysis, and **Helium 10** analysis. The app is the Next.js project at the repository root. The portal is served at `/ads`.

Spend on ads is Shak’s. Every create, budget change, keyword change, and on/off switch is prepared first and runs only after **Confirm**. Sellerboard and Helium 10 stay read-only. The consultant never sees Shak’s passwords or API keys; those stay in server environment variables.

## What the consultant can do

- Amazon PPC: list campaigns, keywords, and the performance numbers already on those records
- Amazon PPC: create or rename a Sponsored Products campaign, change keywords, set a daily budget, turn campaigns on or off
- Sellerboard: read sample profit analysis (not a live account change)
- Helium 10: read sample keyword research (not a live account change)
- Download CSV for campaigns, keywords, and the mutation audit log

PPC reads run immediately. PPC writes become a pending card. Cancel drops the change. The audit log stores applied, cancelled, failed, and refused attempts.

## Hard deny

Anything outside Amazon PPC, Sellerboard, and Helium 10 is refused with: “Access is limited to Amazon PPC, Sellerboard, and Helium 10.”

These are blocked in the chat text, in tool inputs, and again when someone confirms:

- Email, Gmail, and any mailbox
- Seller Central listings, orders, inventory, and FBA (Ads console campaign work stays allowed)
- Other Grok bots and internal platforms
- Passwords, API keys, tokens, and raw credentials
- Wipe or delete account history
- Bulk delete, “delete everything”, or deleting a campaign or keyword
- Billing, cards, payouts, invoices
- Writes to Sellerboard or Helium 10

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
- `sellerboard_snapshot` (read-only analysis)
- `helium10_snapshot` (read-only analysis)

## Simulated mode

If the Amazon variables below are missing, the banner says **Simulated**. Three sample campaigns (`SOT Brand Defense`, `SOT Sensory Chews`, `SOT Auto Discovery`) stand in for the account. Confirm updates that local state and the audit log. It does not call Amazon and does not spend money. Figures in the table are sample data, labeled simulated.

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
| `AMAZON_ADS_REFRESH_TOKEN` | Refresh token for Shak’s ads authorization |
| `AMAZON_ADS_PROFILE_ID` | Profile id sent as `Amazon-Advertising-API-Scope` |
| `AMAZON_ADS_REGION` | `NA` (default), `EU`, or `FE` |
| `AMAZON_ADS_API_BASE` | Optional host override |
| `AMAZON_ADS_TOKEN_URL` | Optional. Default `https://api.amazon.com/auth/o2/token` |
| `ADS_PORTAL_MODEL` | AI Gateway model. Default `openai/gpt-6-luna` |
| `AI_GATEWAY_API_KEY` | Only needed off Vercel. Deployed functions use OIDC. |
| `ADS_PORTAL_PASSWORD` | Shared password for the portal. Set it in Vercel → project **fde-hello** → Settings → Environment Variables for **Production** and **Preview**, then redeploy. The server compares the sign-in form to this value and sets an httpOnly session cookie. If the variable is missing, the portal stays closed. Do not commit the value. |
| `ADS_PORTAL_DEV_BYPASS` | Local API tests only. Value `1` accepts `Authorization: Bearer dev` when `VERCEL` is unset. Ignored on Vercel. The password cookie is still required when `ADS_PORTAL_PASSWORD` is set. |

Live mode turns on only when client id, secret, refresh token, and profile id are all set. The same confirm step still guards writes. See `/ads/connect` in the running app.

Amazon calls use Sponsored Products v3 (`application/vnd.spCampaign.v3+json` and the ad group / keyword equivalents). A new campaign is created with `LEGACY_FOR_SALES` bidding and a default ad group so keywords have somewhere to land.

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

`/` is `public/legacy-home.html` (rewrite). `/eval` is `public/eval/index.html`. Do not put an `app/page.tsx` over `/`, or the bio gate will stop loading.
