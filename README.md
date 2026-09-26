# fde-hello

Prompt-driven GitHub → Vercel demo with Clerk auth gate, plus an invite-only Amazon Ads desk.

Live: https://fde-hello.vercel.app

## Auth

- Clerk app: `fde-hello`
- Publishable key is embedded client-side (expected for Clerk web)
- Enable Multi-factor (Authenticator) in Clerk dashboard for 2FA
- Allow origin / redirect: `https://fde-hello.vercel.app`

## Amazon product dossiers

[Sensationally OT product dossiers](https://fde-hello.vercel.app/eval/) live at `/eval/` (no Clerk gate). Each product is a sourcing page: competitors, a manual China / Sellerboard cost stack, maker opportunity, moat, and Shak’s weighted rubric (GO at 4.20).

Stepping stones and stacking rocks are NPD dossiers with live comp links: [/eval/?asin=B0F3FFQ1CD](https://fde-hello.vercel.app/eval/?asin=B0F3FFQ1CD) and [/eval/?asin=B09BCMP8XX](https://fde-hello.vercel.app/eval/?asin=B09BCMP8XX). CapEx is parked. Sell targets and landed costs are assumptions: stepping $44.99 / landed $16, stacking $26.99 / landed $6. Duty 0% is an assumption.

The first-visit dossiers are the 2026-09-26 Sellerboard baselines: Mermaid dough kit (healthy, net about +$8.90) and Farm dough (Conditional and underwater, net about −$3.77). Both keep the live sell price $39.95. Products Cost ($13.50 / $14.00) stays the override. Current EXW from parsed Greatwall invoices is $10.30 for Mermaid (was $10.25) and $10.35 for Farm (`GW20260123` only). Unicorn $10.35 and Dino $10.30 are reference EXWs, not dossiers. Freight $/unit is manual because shipment totals mix SKUs. The EXW-to-Sellerboard gap is about $3–$3.70 for ocean, duty, and inbound together. The Oct 2023 invoice stays as history and is not added on top. Fee Preview is not live, so the 2026-07-22 COGS Tracker is the fee default (Farm’s tracker row was modeled at $35.95; inbound placement $0; no AWD export). The moat note is public Alibaba only: stock theme kits about $0.50–$3.50 FOB are not the SOT kit. Helium 10 competitor rows are paste-only. This repo has no Helium 10 or Amazon credentials, and the page does not call those APIs. Notes: [eval/README.md](eval/README.md).

## Amazon Ads portal

[Password-gated consultant desk](https://fde-hello.vercel.app/ads) for Shakeel Amir’s Sensationally OT account. The consultant talks only to this app. Amazon Ads credentials stay in server environment variables. The desk is the PPC record for the Mermaid dough and Farm dough kits: Sponsored Products writes (pause/enable, daily budget, keyword bid and on/off, keyword add, negatives, search terms, product targets, and product ads) wait for a stated bet and confirmation, then a later result check. Sellerboard and Helium 10 stay analysis only. Without Ads credentials the desk says API not connected and uses labeled sample data. Login with Amazon setup, env var names, spend caps, and the denylist are in [ads-portal/README.md](ads-portal/README.md). `/` still serves the John AI Smith page. `/eval` serves the product dossiers.
