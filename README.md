# fde-hello

Prompt-driven GitHub → Vercel demo with Clerk auth gate.

Live: https://fde-hello.vercel.app

## Auth

- Clerk app: `fde-hello`
- Publishable key is embedded client-side (expected for Clerk web)
- Enable Multi-factor (Authenticator) in Clerk dashboard for 2FA
- Allow origin / redirect: `https://fde-hello.vercel.app`

## Amazon product eval

[Shak's Amazon Product Evaluation Scorecard](https://fde-hello.vercel.app/eval/) is a static page at `/eval/` (no Clerk gate). Score a listing yourself after you view it — the page does not call Amazon. Notes: [eval/README.md](eval/README.md).
