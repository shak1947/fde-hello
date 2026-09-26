# Product dossiers

Sourcing desk for Sensationally OT Amazon FBA ideas. Each product is one page: listing overview, competitor rows, a China landed-cost estimate, a maker opportunity, moat / barriers, and Shak’s weighted rubric.

Open it at `/eval/` (also `https://fde-hello.vercel.app/eval`). It is a static page with no Clerk gate. Data stays in this browser’s `localStorage` under `shak-sot-amazon-dossiers-v1`. Nothing is uploaded.

Use a local static server (`python3 -m http.server` from the repo root, then `/eval/`). Some browsers block `localStorage` on `file://` URLs.

## Helium 10 and Amazon

There is **no live Helium 10 API and no Amazon API** in this repo. We do not have credentials here, and the page does not scrape.

Competitor stats are **manual entry** or **paste/import**:

- Paste CSV, TSV, or JSON from a Helium 10 export (Cerebro, Black Box, Xray, or a spreadsheet).
- Headers we map: ASIN, Title / Product Name, Price, Monthly Sales / ASIN Sales, Monthly Revenue / ASIN Revenue, Review Count, Rating, BSR / Sales Rank.
- A typed monthly revenue wins. If revenue is blank, the chart uses price × monthly sales.

A live Helium 10 or Amazon pull is future work and needs credentials that are not in this repository.

Dollar outputs on the China section are labeled **ESTIMATE**. They are not freight quotes, duty rulings, or Amazon fee quotes. Air vs sea only labels the freight rate you type. Competitor sales, BSR, and review counts are not filled in for the baselines — paste Helium 10 when you have an export.

## Two cost modes

**Mode 1 — Sellerboard Products Cost.** Mermaid $13.50 and Farm $14.00. When this field is filled it is the cost in use. Sep 2026 blended Amazon fees replace referral plus FBA. Current EXW is not added on top of it.

**Current EXW — parsed Greatwall invoices, 2026-09-26.** Freight $/unit is not filled from these invoices.

| Kit | Current EXW |
| --- | --- |
| Mermaid dough | $10.30 (prior $10.25, not the default) |
| Farm kit | $10.35, invoice `GW20260123` only |
| Unicorn | $10.35, reference only. No dossier. |
| Dino | $10.30, reference only. No dossier. |

Products Cost minus current EXW is $3.20 on Mermaid and $3.65 on Farm. That residual sits in about **$3–$3.70** for ocean, duty, and inbound together. It is not split into those pieces, and it is not a freight-per-unit rate. Typing a freight $/unit later does not change it.

Freight on later shipments is a mixed-SKU total. Examples: $2,950 / $6,850 / $9,307 / $10,800. The page does not divide those totals. Type freight $/unit yourself.

**History — Oct 2023 Greatwall invoice `SENSORY KITGW20231012`.** Not the current sample default:

| Line | Amount |
| --- | --- |
| Kit EXW | $10.65 |
| Sea freight | $4.24 / unit |
| Alibaba fee | $0.35 / unit |
| All-in before duty | $15.24 |
| Duty | Blank. Confirm HTS `3407.00.20` (often 0% MFN). That rate is not entered. |
| AWD/storage | Blank until you type an estimate |

Do not add a typed freight on top of Products Cost. The 2023 sea freight is not copied onto the current EXW.

**Fee model** for a 3.3 lb Large Standard at $39.95 (about 13.39×8.47×2.76 in): referral about $5.99 (15%) + FBA fulfillment about $7.38 = about $13.37. On the baselines this size-tier line is visible and is not added on top of the Sep MTD blended fees.

**COGS Tracker defaults** (Drive, 2026-07-22), used when Fee Preview is not live. Both UI samples keep the live sell price **$39.95**.

| | Mermaid `KIT-MERMAID` | Farm `35-ZREI-MJZW` |
| --- | --- | --- |
| Tracker price | $39.95 (live) | Modeled at **$35.95**, not the live price. 0 units on that row. |
| COGS | $13.50 | $14.00 |
| Fees | Implied $14.76 from the profit below. Not an FBA/referral split. | FBA fulfill $7.55, referral $5.39 on the $35.95 row. At $39.95, referral scales to about $5.99 (15%). FBA stays $7.55. |
| Profit | $11.69 (29.3%) before ads. $8.09 (20.2%) with CPA. | $9.01 (25.1%) on the $35.95 row. |
| Older sheet | June 2025 Inventory: COGS $13.03, fees/unit $13.39, profit $11.74. Not the current COGS. | |

Inbound placement is **$0** in the tracker. There is no AWD Drive export, so AWD/storage stays blank. These tracker lines do not replace Sep MTD blended fees or Sellerboard net.

## First visit

A new browser gets two Sellerboard baselines dated **2026-09-26** (Pricing & Inventory / Listings / Shopify / Sellerboard). They are real listings. Mode 1 uses Products Cost. Current EXW is $10.30 on Mermaid and $10.35 on Farm (`GW20260123` only). Freight per unit starts blank. The Oct 2023 Greatwall invoice stays on the page as history.

| Dossier | Locked snapshot |
| --- | --- |
| **Mermaid dough kit** (`B0CFT7YF1L`, SKU `KIT-MERMAID`) | Sell $39.95. Products Cost $13.50. Sep MTD Amazon fees about $14.12/unit. Sep MTD net about **+$8.90/unit (~22% of price)**. Healthy baseline. |
| **Farm dough** (`B0GCTV28TN`, SKU `35-ZREI-MJZW`) | Sell $39.95, compare-at/list $49.95. Products Cost $14.00. Sep MTD Amazon fees about $18/unit blended, ads high. Sep MTD net about **−$3.77/unit**. Underwater, so a reorder is Conditional until that stack changes. |

Price minus Products Cost minus blended fees is $12.33 on Mermaid and $7.95 on Farm. The gap from those figures to the reported nets ($3.43 and $11.72) is **not** broken out and is **not** an ad-cost measure. Referral ~15% is a planning-rate field. It is not applied while blended fees are filled.

The rubric counts that measured margin (Mermaid 4, Farm 1) plus three product-type starters that are **not** Sellerboard facts: repeat 4, gift 4, OT-fit 5. With those starters the bands are Mermaid **4.18 Conditional** and Farm **3.47 Conditional**. Competition, reviews, size, repack, moat, monthly units, and BSR stay empty. Duty stays blank.

**Restore baselines** puts the two dossiers back if you delete them. Deleting them sticks: the library does not recreate them on the next visit. An older untouched fictional sample (Pebble Calm, Calm Bin, or Bulk Rainbow Rice) is replaced once by these two. A real scorecard saved under `shak-sot-amazon-evals-v1` is kept and is not mixed with the baselines.

## How a verdict gets earned

1. **Overview** — name, ASIN or URL, SKU, sell price, compare-at/list, category, BSR, reviews, rating, notes. An Amazon link is rendered only for a 10-character ASIN that starts with B0. An empty field, a placeholder, or a demo id does not become an `amazon.com/dp` link. Mermaid and Farm use their real listing ids.
2. **Competition** — add or paste leaders. The revenue bars and a suggested competition score read only the rows you entered. Baselines start with an empty table.
3. **China / landed cost** — Mode 1 Sellerboard Products Cost, plus current kit EXW, a manual freight $/unit, Alibaba, duty (blank until HTS is confirmed), and AWD/storage, then FBA fulfillment and referral. Sellerboard presets fill cost, blended fees, and net. EXW buttons set the kit price only and do not fill freight or replace Products Cost.
4. **Maker opportunity** — why, white space, kit angle, gift / OT angle, price band, monthly units. Annual profit is units × 12 × unit profit when those inputs exist.
5. **Moat and barriers** — eight scores (5 is the favorable case), plus “barriers for others” and “our moat plan.” The barrier index uses the same rounding as the rubric. Mermaid and Farm carry a public-Alibaba note, not a score: no 1:1 3-jar-plus-accessories clone with transparent list pricing. Stock theme clay/slime kits list about $0.50–$3.50 FOB (MOQ often 1.4k–3k) and are not SOT-spec. Credible like-for-like remains Greatwall 2023 EXW $10.65 and Sellerboard $13.50–$14 landed. Commodity kits underprice SOT because they are not the same product. Customization (jars, accessories, and the brand kit) is the barrier. That note is not a negotiated quote and is not a Helium 10 row.
6. **Rubric** — the original weighted scorecard. Suggestions from competition, landed margin, and the barrier index can be applied onto the linked rows. They do not overwrite a score until you click Apply.

Bands, half-up to two decimals:

| Shown average | Verdict |
| --- | --- |
| 4.20 and up | **GO** (Strong GO) |
| 3.40–4.19 | **Conditional** |
| below 3.40 | **Pass** |

```
weighted average = sum(score × weight) / sum(weights of counted rows)
```

N/A, Hide, and weight 0 are left out of both sums. 4.195 displays as 4.20 and is GO. 4.194 displays as 4.19 and is Conditional.

Core rows, from Shak: repeat purchase inside about a year, giftability, size/weight (5 = compact), repack ease, and a custom moat so China cannot freely hand the same item to every seller.

Margin suggestion uses Sellerboard net as a percent of sell price when that field is filled. Otherwise, when TACOS is filled and blended fees are not, it uses profit after that TACOS. Otherwise it uses contribution before ads. 32%+ → 5, 20%+ → 4, 12%+ → 3, 6%+ → 2, under 6% → 1.

Landed math:

```
before duty = China EXW/FOB + freight/unit + Alibaba fee
duty $ = before duty × duty %
rebuild = (before duty + duty $ + AWD/storage + packaging) × (1 + spoilage %)
cost used = Sellerboard Products Cost, if filled; otherwise the rebuild
fees = blended Amazon fees, if filled; otherwise referral % × price + FBA fulfillment
contribution = sell price − cost used − fees
```

Blank duty, AWD/storage, packaging, and spoilage count as zero once EXW, freight, or Alibaba is entered. A blank freight counts as zero in that rebuild only. That zero is not a freight quote. A blank duty rate is not a confirmed 0% HTS. The Oct 2023 invoice still sums to $15.24 before duty and is not the current sample. Products Cost overrides the rebuild. When a freight $/unit is also filled, the page warns not to add that freight a second time. Products Cost minus the current EXW stays the ocean/duty/inbound residual. The difference between contribution and Sellerboard net is shown as not broken out.

## Library, compare, export

The library lists each saved product with economics status (Healthy or Underwater when Sellerboard net is filled), rubric verdict, ASIN, SKU, net and Products Cost, and the last update. **New product** starts a blank dossier (empty fields, not a page of fake zeros). Referral defaults to 15% as a planning rate and does nothing until a cost and a price exist, and it is skipped when blended fees are filled.

**Compare** takes two or three products from the library checkboxes.

**Copy summary** writes a markdown brief for a strategy chat. **JSON** and **CSV** download the dossiers. **Import JSON** merges a previous export (same id replaces).

Edits save immediately in this browser.

## Check the math

```bash
node eval/selfcheck.js
```

That locks the original 185 ÷ 43 = 4.30 GO hand total, the exclusion rules, the Mermaid and Farm Sellerboard figures, the Products Cost override, and a Helium-style paste parse.
