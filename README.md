# fde-hello

Prompt-driven GitHub → Vercel demo with Clerk auth gate.

Live: https://fde-hello.vercel.app

## Auth

- Clerk app: `fde-hello`
- Publishable key is embedded client-side (expected for Clerk web)
- Enable Multi-factor (Authenticator) in Clerk dashboard for 2FA
- Allow origin / redirect: `https://fde-hello.vercel.app`

## Amazon product dossiers

[Sensationally OT product dossiers](https://fde-hello.vercel.app/eval/) live at `/eval/` (no Clerk gate). Each product is a sourcing page: competitors, a manual China landed-cost estimate, maker opportunity, moat, and Shak’s weighted rubric (GO at 4.20).

Helium 10 and Amazon numbers are typed or pasted from an export. This repo has no Helium 10 or Amazon credentials, and the page does not call those APIs. A live pull is future work. Notes: [eval/README.md](eval/README.md).
