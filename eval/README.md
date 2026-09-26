# Amazon Product Eval

Static scorecard for weighing Amazon product ideas for Sensationally OT. You look at the listing yourself and enter scores. This page does not call Amazon, Keepa, Helium 10, or any other product API, and it does not invent review counts or dollar margins.

Open it at `/eval/` on the site, or open `eval/index.html` through a local static server. Some browsers block `localStorage` on `file://` URLs.

## How to use

1. Enter the product name, an ASIN or listing URL, category notes, and a date. The URL is only a reminder link so you can reopen the listing. Nothing is fetched.
2. Score each criterion from 1 to 5, or choose N/A to skip it. **5 is always the favorable case.** On inverse criteria (size/weight, returns, seasonality), 5 means compact, low return risk, or year-round demand.
3. Move the weight slider from 0 to 5. Weight 0 leaves that row out. **Hide** does the same and keeps the score if you include it again. Core and starter rows stay in the list; use Hide rather than deleting them.
4. Add a custom criterion when the defaults miss something you care about.
5. Read the weighted average and the verdict.

Bands use the average rounded half-up to two decimals:

| Shown average | Verdict |
| --- | --- |
| 4.20 and up | **GO** (Strong GO) |
| 3.40–4.19 | **Conditional** |
| 3.39 and below | **Pass** |

6. **Save evaluation.** The list lives in this browser’s `localStorage` under `shak-sot-amazon-evals-v1`. It is not uploaded.
7. **Copy summary** pastes a plain-text brief for a product-strategy chat. **Export JSON** or **Export CSV** downloads every saved evaluation.
8. **Compare last** lines up the newest saved evaluations. Each average uses that evaluation’s own weights.

The breakdown bars are the score out of 5. The white tick is the weighted average. Rows under “Pulling the score down” are scored criteria below that average, largest drag first.

## Scoring

Counted rows are the ones that are not hidden, have a weight from 1 to 5, and have a score from 1 to 5.

```
weighted average = sum(score × weight) / sum(weights of counted rows)
```

N/A, Hide, and weight 0 are left out of both the numerator and the denominator. The verdict uses that ratio rounded half-up to two decimals (4.195 displays as 4.20 and is GO; 4.194 displays as 4.19 and is Conditional).

## First visit

The first time this browser opens the page, it stores one fictional evaluation: **Pebble Calm Mini — Sensory Worry Stone Set** (`B0SOTDEMO1`). That product is not real. The notes are judgments written for the sample, not scraped listing data. Deleting it does not bring it back unless you clear the storage key.

With the default weights and the sample scores, the math is `185 ÷ 43 = 4.30`, which is **GO**.
