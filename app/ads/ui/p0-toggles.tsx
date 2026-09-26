"use client";

import { useEffect, useState } from "react";

type Keyword = { keywordId: string; keywordText: string; matchType: string; bid: number; state: string };
type Negative = { entryId: string; kind: string; value: string; matchType: string; scope: string; state: string };
type Target = { targetId: string; asin: string; bid: number; state: string };
type ProductAd = { adId: string; asin: string; sku: string; state: string };

export type P0Campaign = {
  campaignId: string;
  name: string;
  state: "ENABLED" | "PAUSED";
  dailyBudget: number;
  simulated: boolean;
  adGroupId?: string;
  keywords: Keyword[];
  negatives?: Negative[];
  productTargets?: Target[];
  productAds?: ProductAd[];
};

type Caps = {
  maxDailyBudget: number | null;
  maxBid: number | null;
  budgetStatus: string;
  bidStatus: string;
};

type SearchRow = {
  searchTerm: string;
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  impressions: number;
  clicks: number;
  cost: number;
  sales: number;
  orders: number;
  sample: boolean;
};

type Report = {
  label: string;
  sample: boolean;
  status: string;
  note: string;
  rows: SearchRow[];
};

export function P0Toggles({
  campaigns,
  busy,
  caps,
  sampleData,
  propose,
}: {
  campaigns: P0Campaign[];
  busy: boolean;
  caps: Caps | null;
  sampleData: boolean;
  propose: (action: unknown) => Promise<void>;
}) {
  const [campaignId, setCampaignId] = useState(campaigns[0]?.campaignId ?? "");
  const [budget, setBudget] = useState("40");
  const [keyword, setKeyword] = useState("");
  const [matchType, setMatchType] = useState("EXACT");
  const [bid, setBid] = useState("1.25");
  const [bids, setBids] = useState<Record<string, string>>({});
  const [negativeKind, setNegativeKind] = useState<"KEYWORD" | "ASIN">("KEYWORD");
  const [negativeScope, setNegativeScope] = useState<"CAMPAIGN" | "AD_GROUP">("AD_GROUP");
  const [negativeMatch, setNegativeMatch] = useState("NEGATIVE_EXACT");
  const [negativeValue, setNegativeValue] = useState("");
  const [targetAsin, setTargetAsin] = useState("");
  const [targetBid, setTargetBid] = useState("0.85");
  const [targetId, setTargetId] = useState("");
  const [adAsin, setAdAsin] = useState("");
  const [adSku, setAdSku] = useState("");
  const [adId, setAdId] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [termBid, setTermBid] = useState("1.25");
  const [termMatch, setTermMatch] = useState("EXACT");

  useEffect(() => {
    if (!campaignId && campaigns[0]) setCampaignId(campaigns[0].campaignId);
  }, [campaignId, campaigns]);

  const campaign = campaigns.find((item) => item.campaignId === campaignId) ?? campaigns[0];

  async function loadTerms() {
    const response = await fetch("/api/ads/search-terms", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Search terms could not be loaded.");
    setReport(body);
  }

  return (
    <>
      <section className="panel">
        <h2>P0 · Campaign on/off and budget</h2>
        <p className="muted">
          {sampleData ? "Sample controls. API not connected." : "Live Sponsored Products. Confirm before anything is sent."}{" "}
          Server cap: daily budget {capLabel(caps?.maxDailyBudget, caps?.budgetStatus)} · bid{" "}
          {capLabel(caps?.maxBid, caps?.bidStatus)}.
        </p>
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void propose({ type: "set_budget", campaignId: campaign?.campaignId, dailyBudget: Number(budget) });
          }}
        >
          <label>
            Campaign
            <select value={campaign?.campaignId ?? ""} onChange={(event) => setCampaignId(event.target.value)}>
              {campaigns.map((item) => (
                <option key={item.campaignId} value={item.campaignId}>
                  {item.name}
                  {item.simulated ? " (sample)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Daily budget (USD)
            <input value={budget} onChange={(event) => setBudget(event.target.value)} inputMode="decimal" />
          </label>
          <div className="row">
            <button className="btn" type="submit" disabled={busy || !campaign}>
              Prepare budget change
            </button>
            <button
              className="btn-warn"
              type="button"
              disabled={busy || !campaign}
              onClick={() => void propose({ type: "set_campaign_state", campaignIds: [campaign?.campaignId], state: "PAUSED" })}
            >
              Prepare pause
            </button>
            <button
              className="btn-ghost"
              type="button"
              disabled={busy || !campaign}
              onClick={() => void propose({ type: "set_campaign_state", campaignIds: [campaign?.campaignId], state: "ENABLED" })}
            >
              Prepare enable
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>P0 · Keyword bid, pause, and add</h2>
        {campaign?.keywords.length ? (
          <table>
            <thead>
              <tr>
                <th>Keyword</th>
                <th>Match</th>
                <th>State</th>
                <th>Bid</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {campaign.keywords.map((item) => (
                <tr key={item.keywordId}>
                  <td>
                    {item.keywordText}
                    {campaign.simulated ? <span className="tag">Sample</span> : null}
                  </td>
                  <td>{item.matchType}</td>
                  <td>{item.state}</td>
                  <td>
                    <input
                      aria-label={`Bid for ${item.keywordText}`}
                      value={bids[item.keywordId] ?? String(item.bid)}
                      onChange={(event) => setBids((current) => ({ ...current, [item.keywordId]: event.target.value }))}
                      inputMode="decimal"
                    />
                  </td>
                  <td>
                    <div className="row">
                      <button
                        className="btn"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void propose({
                            type: "update_keyword",
                            campaignId: campaign.campaignId,
                            keywordId: item.keywordId,
                            bid: Number(bids[item.keywordId] ?? item.bid),
                          })
                        }
                      >
                        Prepare bid
                      </button>
                      <button
                        className="btn-warn"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void propose({
                            type: "update_keyword",
                            campaignId: campaign.campaignId,
                            keywordId: item.keywordId,
                            state: "PAUSED",
                          })
                        }
                      >
                        Pause
                      </button>
                      <button
                        className="btn-ghost"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void propose({
                            type: "update_keyword",
                            campaignId: campaign.campaignId,
                            keywordId: item.keywordId,
                            state: "ENABLED",
                          })
                        }
                      >
                        Enable
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No keywords on this campaign yet.</p>
        )}
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void propose({
              type: "add_keyword",
              campaignId: campaign?.campaignId,
              adGroupId: campaign?.adGroupId,
              keywordText: keyword,
              matchType,
              bid: Number(bid),
              state: "ENABLED",
            });
          }}
        >
          <label>
            Add keyword
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} />
          </label>
          <label>
            Match
            <select value={matchType} onChange={(event) => setMatchType(event.target.value)}>
              <option>EXACT</option>
              <option>PHRASE</option>
              <option>BROAD</option>
            </select>
          </label>
          <label>
            Bid (USD)
            <input value={bid} onChange={(event) => setBid(event.target.value)} inputMode="decimal" />
          </label>
          <button className="btn" type="submit" disabled={busy || !campaign || !keyword.trim()}>
            Prepare keyword add
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>P0 · Negative keyword or ASIN</h2>
        {campaign?.negatives?.length ? (
          <ul className="deny">
            {campaign.negatives.map((entry) => (
              <li key={entry.entryId}>
                {entry.scope} {entry.kind} {entry.value} ({entry.matchType}, {entry.state})
                {campaign.simulated ? <span className="tag">Sample</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No negatives on this campaign yet.</p>
        )}
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void propose({
              type: "add_negative",
              campaignId: campaign?.campaignId,
              adGroupId: negativeScope === "AD_GROUP" ? campaign?.adGroupId : undefined,
              scope: negativeScope,
              kind: negativeKind,
              keywordText: negativeKind === "KEYWORD" ? negativeValue : undefined,
              matchType: negativeKind === "KEYWORD" ? negativeMatch : undefined,
              asin: negativeKind === "ASIN" ? negativeValue : undefined,
              state: "ENABLED",
            });
          }}
        >
          <label>
            Kind
            <select value={negativeKind} onChange={(event) => setNegativeKind(event.target.value as "KEYWORD" | "ASIN")}>
              <option value="KEYWORD">Keyword</option>
              <option value="ASIN">ASIN</option>
            </select>
          </label>
          <label>
            Scope
            <select value={negativeScope} onChange={(event) => setNegativeScope(event.target.value as "CAMPAIGN" | "AD_GROUP")}>
              <option value="AD_GROUP">Ad group</option>
              <option value="CAMPAIGN">Campaign</option>
            </select>
          </label>
          {negativeKind === "KEYWORD" ? (
            <label>
              Negative match
              <select value={negativeMatch} onChange={(event) => setNegativeMatch(event.target.value)}>
                <option>NEGATIVE_EXACT</option>
                <option>NEGATIVE_PHRASE</option>
                <option>NEGATIVE_BROAD</option>
              </select>
            </label>
          ) : null}
          <label>
            {negativeKind === "ASIN" ? "ASIN" : "Keyword"}
            <input value={negativeValue} onChange={(event) => setNegativeValue(event.target.value)} />
          </label>
          <button className="btn" type="submit" disabled={busy || !campaign || !negativeValue.trim()}>
            Prepare negative
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>P0 · Search terms</h2>
        <p className="muted">{report?.note || "Load the report. Sample rows stay labeled until the API is connected."}</p>
        <div className="row">
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={() => {
              void loadTerms().catch((err: unknown) => {
                setReport({
                  label: "API not connected",
                  sample: true,
                  status: "FAILED",
                  note: err instanceof Error ? err.message : "Search terms could not be loaded.",
                  rows: [],
                });
              });
            }}
          >
            Load search terms
          </button>
          {report ? <span className={report.sample ? "pill sim" : "pill live"}>{report.label}</span> : null}
        </div>
        <label>
          Bid when applying as a keyword
          <input value={termBid} onChange={(event) => setTermBid(event.target.value)} inputMode="decimal" />
        </label>
        <label>
          Positive match
          <select value={termMatch} onChange={(event) => setTermMatch(event.target.value)}>
            <option>EXACT</option>
            <option>PHRASE</option>
            <option>BROAD</option>
          </select>
        </label>
        {report?.rows.length ? (
          <table>
            <thead>
              <tr>
                <th>Search term</th>
                <th>Campaign</th>
                <th>Clicks</th>
                <th>Cost</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={`${row.campaignId}-${row.searchTerm}`}>
                  <td>
                    {row.searchTerm}
                    {row.sample ? <span className="tag">Sample</span> : null}
                  </td>
                  <td>{row.campaignName}</td>
                  <td>{row.clicks}</td>
                  <td>${row.cost.toFixed(2)}</td>
                  <td>
                    <div className="row">
                      <button
                        className="btn"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void propose({
                            type: "apply_search_term",
                            campaignId: row.campaignId,
                            adGroupId: row.adGroupId,
                            searchTerm: row.searchTerm,
                            as: "KEYWORD",
                            matchType: termMatch,
                            bid: Number(termBid),
                            state: "ENABLED",
                          })
                        }
                      >
                        Prepare as keyword
                      </button>
                      <button
                        className="btn-warn"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void propose({
                            type: "apply_search_term",
                            campaignId: row.campaignId,
                            adGroupId: row.adGroupId,
                            searchTerm: row.searchTerm,
                            as: /^B0[A-Z0-9]{8}$/i.test(row.searchTerm) ? "NEGATIVE_ASIN" : "NEGATIVE_KEYWORD",
                            matchType: /^B0[A-Z0-9]{8}$/i.test(row.searchTerm) ? "NEGATIVE_EXACT" : "NEGATIVE_EXACT",
                            scope: "AD_GROUP",
                            state: "ENABLED",
                          })
                        }
                      >
                        Prepare as negative
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="panel">
        <h2>P0 · Product target and product ad</h2>
        {campaign?.productTargets?.length ? (
          <ul className="deny">
            {campaign.productTargets.map((target) => (
              <li key={target.targetId}>
                Target {target.asin} ${target.bid.toFixed(2)} {target.state}
                <button className="btn-ghost" type="button" disabled={busy} onClick={() => setTargetId(target.targetId)}>
                  Edit this target
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void propose({
              type: "upsert_product_target",
              campaignId: campaign?.campaignId,
              adGroupId: campaign?.adGroupId,
              targetId: targetId || undefined,
              asin: targetAsin,
              bid: Number(targetBid),
              state: "ENABLED",
            });
          }}
        >
          <label>
            Target ASIN
            <input value={targetAsin} onChange={(event) => setTargetAsin(event.target.value)} placeholder="B0SAMPLE02" />
          </label>
          <label>
            Existing target id (optional, for a bid edit)
            <input value={targetId} onChange={(event) => setTargetId(event.target.value)} />
          </label>
          <label>
            Bid (USD)
            <input value={targetBid} onChange={(event) => setTargetBid(event.target.value)} inputMode="decimal" />
          </label>
          <div className="row">
            <button className="btn" type="submit" disabled={busy || !campaign || !targetAsin.trim()}>
              Prepare product target
            </button>
            <button
              className="btn-warn"
              type="button"
              disabled={busy || !campaign || !targetId}
              onClick={() =>
                void propose({
                  type: "upsert_product_target",
                  campaignId: campaign?.campaignId,
                  targetId,
                  asin: targetAsin || campaign?.productTargets?.find((item) => item.targetId === targetId)?.asin,
                  state: "PAUSED",
                })
              }
            >
              Prepare target pause
            </button>
          </div>
        </form>
        {campaign?.productAds?.length ? (
          <ul className="deny">
            {campaign.productAds.map((ad) => (
              <li key={ad.adId}>
                Ad {ad.asin || ad.sku} {ad.state} ({ad.adId})
                {campaign.simulated ? <span className="tag">Sample</span> : null}
                <button className="btn-ghost" type="button" disabled={busy} onClick={() => setAdId(ad.adId)}>
                  Use this ad
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void propose({
              type: "manage_product_ad",
              campaignId: campaign?.campaignId,
              adGroupId: campaign?.adGroupId,
              asin: adAsin || undefined,
              sku: adSku || undefined,
              state: "PAUSED",
            });
          }}
        >
          <label>
            Product ad ASIN
            <input value={adAsin} onChange={(event) => setAdAsin(event.target.value)} />
          </label>
          <label>
            SKU (optional, sellers)
            <input value={adSku} onChange={(event) => setAdSku(event.target.value)} />
          </label>
          <label>
            Existing ad id (pause or enable)
            <input value={adId} onChange={(event) => setAdId(event.target.value)} />
          </label>
          <div className="row">
            <button className="btn" type="submit" disabled={busy || !campaign || (!adAsin.trim() && !adSku.trim())}>
              Prepare product ad
            </button>
            <button
              className="btn-warn"
              type="button"
              disabled={busy || !adId}
              onClick={() =>
                void propose({ type: "manage_product_ad", campaignId: campaign?.campaignId, adId, state: "PAUSED" })
              }
            >
              Prepare ad pause
            </button>
            <button
              className="btn-ghost"
              type="button"
              disabled={busy || !adId}
              onClick={() =>
                void propose({ type: "manage_product_ad", campaignId: campaign?.campaignId, adId, state: "ENABLED" })
              }
            >
              Prepare ad enable
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

function capLabel(value: number | null | undefined, status: string | undefined): string {
  if (status === "invalid") return "misconfigured";
  if (value == null) return "not set";
  return `$${value.toFixed(2)}`;
}
