"use client";

import { useState } from "react";

export type ChallengeBody = {
  intent: string;
  expectedSpend: number;
  expectedAcos: number | null;
  expectedTacos: number | null;
  expectedOrders: number;
  timelineDays: number;
  defense: string;
};

export function ChallengeCard({
  id,
  summary,
  busy,
  onConfirm,
  onCancel,
}: {
  id: string;
  summary: string;
  busy: boolean;
  onConfirm: (id: string, challenge: ChallengeBody) => Promise<string | null>;
  onCancel: (id: string) => Promise<void>;
}) {
  const [intent, setIntent] = useState("");
  const [spend, setSpend] = useState("");
  const [acos, setAcos] = useState("");
  const [tacos, setTacos] = useState("");
  const [orders, setOrders] = useState("");
  const [days, setDays] = useState("14");
  const [defense, setDefense] = useState("");
  const [question, setQuestion] = useState("");

  async function submit() {
    const next = await onConfirm(id, {
      intent,
      expectedSpend: Number(spend),
      expectedAcos: acos.trim() ? Number(acos) : null,
      expectedTacos: tacos.trim() ? Number(tacos) : null,
      expectedOrders: Number(orders),
      timelineDays: Number(days),
      defense,
    });
    setQuestion(next ?? "");
  }

  return (
    <form
      className="stack challenge"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <strong>{summary}</strong>
      <p className="muted">
        Confirm is the bet. Say what you are changing, which kit it serves, and the spend, efficiency, orders, and
        timeline you will be checked against.
      </p>
      <label>
        Intent — what is changing, and why this kit
        <textarea value={intent} onChange={(event) => setIntent(event.target.value)} rows={3} required />
      </label>
      <div className="row metrics">
        <label>
          Expected spend (USD)
          <input value={spend} onChange={(event) => setSpend(event.target.value)} inputMode="decimal" required />
        </label>
        <label>
          Expected ACoS %
          <input value={acos} onChange={(event) => setAcos(event.target.value)} inputMode="decimal" />
        </label>
        <label>
          Expected TACOS %
          <input value={tacos} onChange={(event) => setTacos(event.target.value)} inputMode="decimal" />
        </label>
        <label>
          Expected orders
          <input value={orders} onChange={(event) => setOrders(event.target.value)} inputMode="numeric" required />
        </label>
        <label>
          Timeline (days)
          <input value={days} onChange={(event) => setDays(event.target.value)} inputMode="numeric" required />
        </label>
      </div>
      {question ? (
        <p className="question" role="status">
          {question}
        </p>
      ) : null}
      <label>
        Answer, if the bet is thin
        <textarea
          value={defense}
          onChange={(event) => setDefense(event.target.value)}
          rows={2}
          placeholder="Why this is still the right change for this kit"
        />
      </label>
      <div className="row">
        <button className="btn" type="submit" disabled={busy}>
          Confirm — {summary}
        </button>
        <button className="btn-bad" type="button" disabled={busy} onClick={() => void onCancel(id)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
