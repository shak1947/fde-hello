"use client";

import { useState } from "react";

export type FeedbackCheckView = {
  id: string;
  at: string;
  reviewAfter: string;
  actorLabel: string;
  kitName: string;
  summary: string;
  status: "awaiting" | "recorded";
  challenge: {
    intent: string;
    expectedSpend: number;
    expectedAcos: number | null;
    expectedTacos: number | null;
    expectedOrders: number;
    timelineDays: number;
    strength: "stated" | "thin";
    question: string | null;
  };
  comparison: { verdict: string; early: boolean; lines: string[]; stub: true } | null;
};

export function FeedbackPanel({
  checks,
  busy,
  onRecord,
}: {
  checks: FeedbackCheckView[];
  busy: boolean;
  onRecord: (body: {
    id: string;
    spend: number;
    acos: number | null;
    tacos: number | null;
    orders: number;
    note: string;
  }) => Promise<void>;
}) {
  return (
    <section className="panel">
      <h2>After the change</h2>
      <p className="muted">
        Each confirmed write keeps the bet. When the timeline is up, record what happened. The comparison is a stub:
        it uses the numbers entered here and does not pull a live Amazon report yet. Shak can hold the manager to the
        bet on this desk.
      </p>
      {checks.length ? (
        <div className="stack">
          {checks.map((check) => (
            <FeedbackRow key={check.id} check={check} busy={busy} onRecord={onRecord} />
          ))}
        </div>
      ) : (
        <p className="muted">No bets yet. A confirmed write lands here with its expected spend, efficiency, orders, and date.</p>
      )}
    </section>
  );
}

function FeedbackRow({
  check,
  busy,
  onRecord,
}: {
  check: FeedbackCheckView;
  busy: boolean;
  onRecord: (body: {
    id: string;
    spend: number;
    acos: number | null;
    tacos: number | null;
    orders: number;
    note: string;
  }) => Promise<void>;
}) {
  const [spend, setSpend] = useState("");
  const [acos, setAcos] = useState("");
  const [tacos, setTacos] = useState("");
  const [orders, setOrders] = useState("");
  const [note, setNote] = useState("");
  const bet = check.challenge;
  return (
    <article className="kit">
      <h3>
        {check.kitName} · {check.status === "recorded" ? check.comparison?.verdict ?? "recorded" : "awaiting"}
      </h3>
      <p>{check.summary}</p>
      <p className="muted">
        {check.actorLabel} · check {check.reviewAfter.slice(0, 10)} · {bet.strength}
        {bet.strength === "thin" ? " justification" : " bet"}
      </p>
      <p>
        Bet: spend ${bet.expectedSpend.toFixed(2)}
        {bet.expectedAcos == null ? "" : ` · ACoS ${bet.expectedAcos}%`}
        {bet.expectedTacos == null ? "" : ` · TACOS ${bet.expectedTacos}%`}
        {` · ${bet.expectedOrders} orders · ${bet.timelineDays}d`}
      </p>
      <p className="muted">{bet.intent}</p>
      {bet.question ? <p className="question">{bet.question}</p> : null}
      {check.comparison ? (
        <ul className="deny">
          {check.comparison.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void onRecord({
              id: check.id,
              spend: Number(spend),
              acos: acos.trim() ? Number(acos) : null,
              tacos: tacos.trim() ? Number(tacos) : null,
              orders: Number(orders),
              note,
            });
          }}
        >
          <div className="row metrics">
            <label>
              Actual spend
              <input value={spend} onChange={(event) => setSpend(event.target.value)} inputMode="decimal" required />
            </label>
            <label>
              Actual ACoS %
              <input value={acos} onChange={(event) => setAcos(event.target.value)} inputMode="decimal" />
            </label>
            <label>
              Actual TACOS %
              <input value={tacos} onChange={(event) => setTacos(event.target.value)} inputMode="decimal" />
            </label>
            <label>
              Actual orders
              <input value={orders} onChange={(event) => setOrders(event.target.value)} inputMode="numeric" required />
            </label>
          </div>
          <label>
            What happened
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} required />
          </label>
          <button className="btn" type="submit" disabled={busy}>
            Record result
          </button>
        </form>
      )}
    </article>
  );
}
