# fde-hello

Prompt-driven GitHub → Vercel demo with Clerk auth gate.

Live: https://fde-hello.vercel.app

## Auth

- Clerk app: `fde-hello`
- Publishable key is embedded client-side (expected for Clerk web)
- Enable Multi-factor (Authenticator) in Clerk dashboard for 2FA
- Allow origin / redirect: `https://fde-hello.vercel.app`

## Amazon product dossiers

[Sensationally OT product dossiers](https://fde-hello.vercel.app/eval/) live at `/eval/` (no Clerk gate). Each product is a sourcing page: competitors, a manual China / Sellerboard cost stack, maker opportunity, moat, and Shak’s weighted rubric (GO at 4.20).

The first-visit dossiers are the 2026-09-26 Sellerboard baselines: Mermaid dough kit (healthy, net about +$8.90) and Farm dough (underwater, net about −$3.77). Products Cost ($13.50 / $14.00) is all-in until an invoice splits China and freight. Helium 10 competitor rows are paste-only. This repo has no Helium 10 or Amazon credentials, and the page does not call those APIs. Notes: [eval/README.md](eval/README.md).
