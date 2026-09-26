# fde-hello

Prompt-driven GitHub → Vercel demo with Clerk auth gate, plus an invite-only Amazon Ads desk.

Live: https://fde-hello.vercel.app

## Auth

- Clerk app: `fde-hello`
- Publishable key is embedded client-side (expected for Clerk web)
- Enable Multi-factor (Authenticator) in Clerk dashboard for 2FA
- Allow origin / redirect: `https://fde-hello.vercel.app`

## Amazon product eval

[Shak's Amazon Product Evaluation Scorecard](https://fde-hello.vercel.app/eval/) is a static page at `/eval/` (no Clerk gate). Score a listing yourself after you view it — the page does not call Amazon. Notes: [eval/README.md](eval/README.md).

## Amazon Ads portal

[Invite-only Amazon Advertising desk](https://fde-hello.vercel.app/ads) for an offshore consultant on Shakeel Amir’s Sensationally OT account. Scope is Amazon Ads only: campaigns, keywords, budgets, and on/off, with confirmation and an audit log. Setup, env vars, the denylist, and `ads.sensationallyot.com` DNS are in [ads-portal/README.md](ads-portal/README.md). `/` and `/eval` are unchanged.
