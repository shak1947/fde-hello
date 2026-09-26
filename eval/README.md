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

## First visit

A new browser gets two Sellerboard baselines dated **2026-09-26** (Pricing & Inventory / Listings / Shopify / Sellerboard). They are real listings. China EXW/FOB versus freight is **not** split; Products Cost is all-in until an invoice parse.

| Dossier | Locked snapshot |
| --- | --- |
| **Mermaid dough kit** (`B0CFT7YF1L`, SKU `KIT-MERMAID`) | Sell $39.95. Products Cost $13.50. Sep MTD Amazon fees about $14.12/unit. Sep MTD net about **+$8.90/unit (~22% of price)**. Healthy baseline. |
| **Farm dough** (`B0GCTV28TN`, SKU `35-ZREI-MJZW`) | Sell $39.95, compare-at/list $49.95. Products Cost $14.00. Sep MTD Amazon fees about $18/unit blended, ads high. Sep MTD net about **−$3.77/unit**. Underwater, so a reorder is Conditional until that stack changes. |

Price minus Products Cost minus blended fees is $12.33 on Mermaid and $7.95 on Farm. The gap from those figures to the reported nets ($3.43 and $11.72) is **not** broken out and is **not** an ad-cost measure. Referral ~15% is a planning-rate field. It is not applied while blended fees are filled.

The rubric counts that measured margin (Mermaid 4, Farm 1) plus three product-type starters that are **not** Sellerboard facts: repeat 4, gift 4, OT-fit 5. With those starters the bands are Mermaid **4.18 Conditional** and Farm **3.47 Conditional**. Competition, reviews, size, repack, moat, monthly units, BSR, and the China split stay empty.

**Restore baselines** puts the two dossiers back if you delete them. Deleting them sticks: the library does not recreate them on the next visit. An older untouched fictional sample (Pebble Calm, Calm Bin, or Bulk Rainbow Rice) is replaced once by these two. A real scorecard saved under `shak-sot-amazon-evals-v1` is kept and is not mixed with the baselines.

## How a verdict gets earned

1. **Overview** — name, ASIN or URL (link only), SKU, sell price, compare-at/list, category, BSR, reviews, rating, notes.
2. **Competition** — add or paste leaders. The revenue bars and a suggested competition score read only the rows you entered. Baselines start with an empty table.
3. **China / landed cost** — Sellerboard Products Cost (override), China EXW/FOB, freight per unit, duty %, AWD/storage estimate, optional packaging and spoilage, blended Amazon fees, FBA fulfillment, referral ~15%, optional ads/TACOS, and Sellerboard net. Presets fill the Mermaid or Farm Sellerboard trio (cost, blended fees, net) without inventing a China versus freight split.
4. **Maker opportunity** — why, white space, kit angle, gift / OT angle, price band, monthly units. Annual profit is units × 12 × unit profit when those inputs exist.
5. **Moat and barriers** — eight scores (5 is the favorable case), plus “barriers for others” and “our moat plan.” The barrier index uses the same rounding as the rubric.
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
build-up = (China EXW/FOB + freight/unit + duty $ + AWD/storage + packaging) × (1 + spoilage %)
duty $ = (China EXW/FOB + freight/unit) × duty %
cost used = Sellerboard Products Cost, if filled; otherwise the build-up
fees = blended Amazon fees, if filled; otherwise referral % × price + FBA fulfillment
contribution = sell price − cost used − fees
```

Blank duty, AWD/storage, packaging, and spoilage count as zero once China or freight is entered, so a China + freight pair can be compared with $13.50 (Mermaid) and $14.00 (Farm). Products Cost overrides that build-up. The difference between contribution and Sellerboard net is shown as not broken out.

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
