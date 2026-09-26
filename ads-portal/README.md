# Sensationally OT Amazon Ads portal

Invite-only desk for an offshore consultant working **Amazon Advertising only** on Shakeel Amir’s Sensationally OT account. The app is the Next.js project at the repository root. The portal is served at `/ads`.

Spend is Shak’s. Every create, budget change, keyword change, and on/off switch is prepared first and runs only after **Confirm**.

## What the consultant can do

- List campaigns, keywords, and the performance numbers already on those records
- Create or rename a Sponsored Products campaign
- Change keyword text, match type, bid, and on/off state
- Set a daily budget
- Turn campaigns on (`ENABLED`) or off (`PAUSED`)
- Download CSV for campaigns, keywords, and the mutation audit log

Reads run immediately. Writes become a pending card. Cancel drops the change. The audit log stores applied, cancelled, failed, and refused attempts.

## Hard deny

These are blocked in the chat text, in tool inputs, and again when someone confirms:

- Wipe or delete account history
- Bulk delete, “delete everything”, or deleting a campaign or keyword
- Billing, cards, payouts, invoices
- Listings, inventory, Seller Central, FBA
- General assistant chat, other bots, or instruction bypasses

There is no delete tool and no Amazon request path outside Sponsored Products campaign, ad group, and keyword list/create/update. The HTTP client rejects `DELETE`.

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
| `ADS_PORTAL_DEV_BYPASS` | Local only. Value `1` skips Clerk when `VERCEL` is unset. Ignored on Vercel. |

Live mode turns on only when client id, secret, refresh token, and profile id are all set. The same confirm step still guards writes. See `/ads/connect` in the running app.

Amazon calls use Sponsored Products v3 (`application/vnd.spCampaign.v3+json` and the ad group / keyword equivalents). A new campaign is created with `LEGACY_FOR_SALES` bidding and a default ad group so keywords have somewhere to land.

## Login gate

1. Clerk Dashboard → the fde-hello application.
2. Configure → Restrictions → enable **Restricted** so strangers cannot sign up.
3. Users → **Invite** → consultant email.
4. Allowed origins must include every host that serves the portal:
   - `https://fde-hello.vercel.app`
   - the Vercel preview URL
   - `https://ads.sensationallyot.com` once DNS is live
5. The consultant opens `/ads` and uses the invite email. The sign-in widget’s sign-up link goes to `/ads/invite-only`, which does not create an account.
6. Session tokens are checked against that Clerk instance’s JWKS. API routes return 401 without a valid session.

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
4. Add `https://ads.sensationallyot.com` to Clerk allowed origins.
5. `proxy.ts` rewrites `/` on an `ads.*` host to the portal. Every other host still serves the John AI Smith page at `/` and the scorecard at `/eval`.

## Local

```bash
npm install
npm test
npm run dev
```

Open `http://localhost:3000/ads`. With `ADS_PORTAL_DEV_BYPASS=1` in `.env.local` (and without `VERCEL`), the sign-in card offers **Enter local simulator**.

`npm test` covers the denylist, confirm-before-write, audit CSV, formula-safe CSV, Amazon path guard, and Clerk token checks.

## Existing pages

`/` is `public/legacy-home.html` (rewrite). `/eval` is `public/eval/index.html`. Do not put an `app/page.tsx` over `/`, or the bio gate will stop loading.
