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

Dollar outputs on the China section are labeled **ESTIMATE**. They are not freight quotes, duty rulings, or Amazon fee quotes. Air vs sea only labels the freight rate you type.

## First visit

A new browser gets two fictional dossiers:

| Dossier | What it is for |
| --- | --- |
| **Calm Bin — OT Sensory Rice Kit** (`B0SOTDEMO1`) | Full GO file. Giftable sensory kit against rainbow oats / dyed rice. Competitors, China cost, maker plan, and moat are filled. Overall rubric **4.30 GO**. Barrier index **3.75 Conditional**. |
| **Bulk Rainbow Rice — Commodity 2 lb** (`B0SOTDEMO2`) | The same aisle as a me-too bag. Rubric **Pass**. Use it to compare. |

Those ASINs, ranks, review counts, and costs are made up. They are not marketplace data. **Restore samples** puts them back if you delete them. An older Pebble Calm scorecard that was never edited is replaced by these two on first open of the dossier.

If this browser already had real scorecards under `shak-sot-amazon-evals-v1`, those rubric scores are kept and the new sections start empty.

## How a verdict gets earned

1. **Overview** — name, ASIN or URL (link only), category, price, BSR, reviews, rating, FBA fee estimate, notes.
2. **Competition** — add or paste leaders. The revenue bars and a suggested competition score read only the rows you entered.
3. **China / landed cost** — unit EXW or FOB, MOQ, sea or air, freight per unit, duty %, Amazon inbound, packaging, spoilage buffer, referral %, optional TACOS. Outputs: landed cost, contribution, breakeven units, cash tied at MOQ.
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

Margin suggestion, when TACOS is filled, uses profit after that TACOS as a percent of price. Otherwise it uses contribution before ads. 32%+ → 5, 20%+ → 4, 12%+ → 3, 6%+ → 2, under 6% → 1.

Landed math:

```
customs stand-in = unit cost + freight per unit
duty $ = customs stand-in × duty %
before buffer = customs stand-in + duty + Amazon inbound + packaging
landed = before buffer × (1 + spoilage buffer %)
contribution = price − referral − FBA fees − landed
breakeven units = MOQ × landed / contribution, rounded up
```

## Library, compare, export

The library lists each saved product with verdict, ASIN, a revenue hint from the unit plan, and the last update. **New product** starts a blank dossier (empty fields, not a page of fake zeros).

**Compare** takes two or three products from the library checkboxes.

**Copy summary** writes a markdown brief for a strategy chat. **JSON** and **CSV** download the dossiers. **Import JSON** merges a previous export (same id replaces).

Edits save immediately in this browser.

## Check the math

```bash
node eval/selfcheck.js
```

That locks the original 185 ÷ 43 = 4.30 GO sample, the exclusion rules, the Calm Bin landed estimate, and a Helium-style paste parse.
