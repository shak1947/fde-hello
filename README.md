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

[Password-gated consultant desk](https://fde-hello.vercel.app/ads) for Shakeel Amir’s Sensationally OT account. Access is limited to Amazon PPC (campaigns, keywords, budgets, on/off, with confirmation), plus Sellerboard and Helium 10 analysis. Set `ADS_PORTAL_PASSWORD` in the Vercel project environment (do not commit the value). Setup, env vars, the denylist, and `ads.sensationallyot.com` DNS are in [ads-portal/README.md](ads-portal/README.md). `/` and `/eval` are unchanged.
