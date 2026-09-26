"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChallengeCard, type ChallengeBody } from "./challenge-card";
import { FeedbackPanel, type FeedbackCheckView } from "./feedback-panel";
import { P0Toggles, type P0Campaign } from "./p0-toggles";
import { SkuDesk, type KitCard } from "./sku-desk";

type Campaign = P0Campaign & {
  targetingType: "MANUAL" | "AUTO";
  spend: number | null;
  sales: number | null;
  clicks: number | null;
  impressions: number | null;
};

type Proposal = {
  id: string;
  status: string;
  summary: string;
  result?: { summary: string; before: unknown; after: unknown; mode: string };
  error?: string;
};

type AuditEvent = {
  id: string;
  at: string;
  actorLabel: string;
  actionType: string;
  status: string;
  summary: string;
  mode: string;
  intent?: string;
  expected?: string;
  challengeStrength?: string;
};

type CatalogKit = { kitId: string; name: string; sku: string; asin: string };

type Workspace = {
  mode: "dry-run" | "live";
  actorLabel?: string;
  spendOwner: string;
  account: string;
  connectHint: string;
  connectionLabel?: string;
  sampleData?: boolean;
  caps?: {
    maxDailyBudget: number | null;
    maxBid: number | null;
    budgetStatus: string;
    bidStatus: string;
  };
  catalog?: CatalogKit[];
  kits?: KitCard[];
  campaigns: Campaign[];
  proposals: Proposal[];
  audit: AuditEvent[];
  checks?: FeedbackCheckView[];
};

type ChatLine = { role: "user" | "desk"; text: string };

const SUGGESTIONS = [
  "List campaigns and spend",
  "Pause SOT Sensory Chews",
  "Set budget of SOT Brand Defense to $40",
  "Add exact keyword sensory chew to SOT Brand Defense at $1.25",
  "Show Sellerboard profit",
  "Helium 10 research for sensory chew",
];

export function AdsPortal() {
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [who, setWho] = useState("Shared password");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([
    {
      role: "desk",
      text: "Access is limited to Amazon PPC, Sellerboard, and Helium 10. This desk is the record for Mermaid dough and Farm dough. Spend is Shakeel Amir’s. A write needs a bet — intent, spend, ACoS or TACOS, orders, and a timeline — then confirmation. Sellerboard and Helium 10 are analysis only.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newBudget, setNewBudget] = useState("25");
  const [targeting, setTargeting] = useState("MANUAL");
  const [newState, setNewState] = useState("PAUSED");
  const [newKit, setNewKit] = useState("mermaid");
  const [latest, setLatest] = useState<Proposal | null>(null);

  const authed = phase === "ready";

  const authHeaders = useCallback(async () => {
    return { "Content-Type": "application/json" };
  }, []);

  const refresh = useCallback(async () => {
    const headers = await authHeaders();
    const response = await fetch("/api/ads/workspace", { headers, cache: "no-store" });
    const body = await response.json();
    if (response.status === 401) throw new Error(body.error || "Sign in required.");
    if (!response.ok) throw new Error(body.error || "Could not load campaigns.");
    setWho(body.actorLabel || "Shared password");
    setWorkspace(body);
  }, [authHeaders]);

  useEffect(() => {
    let cancelled = false;
    refresh()
      .then(() => {
        if (!cancelled) setPhase("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Load failed.";
        if (/sign in required/i.test(message)) {
          window.location.assign("/ads/enter");
          return;
        }
        setPhase("error");
        setError(message);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setError("");
    setDraft("");
    setLines((current) => [...current, { role: "user", text: message }]);
    try {
      const headers = await authHeaders();
      const response = await fetch("/api/ads/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({ message }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Chat failed.");
      setLines((current) => [...current, { role: "desk", text: body.text }]);
      if (body.proposals?.length) await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed.");
    } finally {
      setBusy(false);
    }
  }

  async function propose(action: unknown) {
    setBusy(true);
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch("/api/ads/proposals", {
        method: "POST",
        headers,
        body: JSON.stringify(action),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not prepare that change.");
      setLines((current) => [
        ...current,
        { role: "desk", text: `Prepared: ${body.proposal.summary}. Confirm it before anything is sent.` },
      ]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare that change.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(id: string, challenge: ChallengeBody): Promise<string | null> {
    setBusy(true);
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`/api/ads/proposals/${id}/confirm`, {
        method: "POST",
        headers,
        body: JSON.stringify(challenge),
      });
      const body = await response.json();
      if (response.status === 409 && body.question) return String(body.question);
      if (!response.ok) throw new Error(body.error || "Could not confirm that change.");
      setLatest(body.proposal);
      setLines((current) => [
        ...current,
        { role: "desk", text: body.proposal.result?.summary || body.proposal.summary },
      ]);
      await refresh();
      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm that change.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function reject(id: string) {
    setBusy(true);
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`/api/ads/proposals/${id}/reject`, { method: "POST", headers });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not cancel that change.");
      setLines((current) => [...current, { role: "desk", text: `Cancelled. ${body.proposal.summary}` }]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel that change.");
    } finally {
      setBusy(false);
    }
  }

  async function recordResult(body: {
    id: string;
    spend: number;
    acos: number | null;
    tacos: number | null;
    orders: number;
    note: string;
  }) {
    setBusy(true);
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch("/api/ads/feedback", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not record that result.");
      const verdict = payload.check?.comparison?.verdict || "recorded";
      setLines((current) => [...current, { role: "desk", text: `Result recorded: ${verdict}.` }]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record that result.");
    } finally {
      setBusy(false);
    }
  }

  async function download(dataset: "campaigns" | "keywords" | "audit") {
    setError("");
    const headers = await authHeaders();
    const response = await fetch(`/api/ads/export?dataset=${dataset}`, { headers });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error || "Export failed.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sot-ads-${dataset}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const pending = useMemo(
    () => workspace?.proposals.filter((item) => item.status === "pending") ?? [],
    [workspace],
  );

  async function signOut() {
    await fetch("/api/ads/logout", { method: "POST" });
    window.location.assign("/ads/enter");
  }

  if (!authed) {
    return (
      <main className="gate">
        <section className="gate-card">
          <p className="eyebrow">Sensationally OT</p>
          <h1>Amazon Ads desk</h1>
          <p className="muted">{phase === "error" ? error || "Could not open the desk." : "Checking access…"}</p>
          {phase === "error" ? <a href="/ads/enter">Back to sign-in</a> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <a className="skip" href="#desk">
        Skip to desk
      </a>
      <header className="top">
        <div>
          <p className="eyebrow">Sensationally OT</p>
          <h1>Amazon Ads portal</h1>
          <p className="muted">Signed in as {who}</p>
        </div>
        <div className="nav-links">
          <a className="chip" href="/">
            Site home
          </a>
          <a className="chip" href="/eval">
            Product eval
          </a>
          <a className="chip" href="/ads/connect">
            Connect Ads API
          </a>
          <button className="btn-ghost" type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <section className="banner">
        <strong>Access is limited to Amazon PPC, Sellerboard, and Helium 10.</strong>{" "}
        <span className="muted">
          Spend is {workspace?.spendOwner ?? "Shakeel Amir"}’s. PPC writes wait for confirmation. Sellerboard and
          Helium 10 are analysis only. Passwords and API keys stay on the server. {workspace?.connectHint}{" "}
          <span className={workspace?.mode === "live" ? "pill live" : "pill sim"}>
            {workspace?.connectionLabel || (workspace?.mode === "live" ? "Live Ads API" : "API not connected")}
          </span>
        </span>
      </section>

      {error ? <p className="banner">{error}</p> : null}

      <div className="grid">
        <aside className="stack">
          <section className="panel">
            <h2>Allowed</h2>
            <ul className="deny">
              <li>Amazon PPC on Mermaid dough and Farm dough: pause/enable, budget, bids, keywords, negatives, search terms, product targets and ads</li>
              <li>A written bet before every confirm, then a later result check</li>
              <li>Sellerboard analysis and profit data</li>
              <li>Helium 10 analysis and keyword research</li>
              <li>Export CSV and read the audit log</li>
            </ul>
          </section>
          <section className="panel">
            <h2>Refused</h2>
            <ul className="deny">
              <li>Email, Gmail, and any mailbox</li>
              <li>Seller Central listings, orders, and inventory</li>
              <li>Other Grok bots and internal platforms</li>
              <li>Passwords, API keys, and raw credentials</li>
              <li>Archive, deletes, billing, and wiping history</li>
              <li>Helium 10 Manage writes</li>
            </ul>
          </section>
          <section className="panel">
            <h2>Downloads</h2>
            <div className="row">
              <button className="btn-ghost" type="button" onClick={() => download("campaigns")}>
                Campaigns CSV
              </button>
              <button className="btn-ghost" type="button" onClick={() => download("keywords")}>
                Keywords CSV
              </button>
              <button className="btn-ghost" type="button" onClick={() => download("audit")}>
                Audit CSV
              </button>
            </div>
          </section>
        </aside>

        <div className="stack" id="desk">
          <section className="panel">
            <h2>Desk</h2>
            <div className="chat" aria-live="polite">
              {lines.map((line, index) => (
                <div className={`bubble ${line.role}`} key={`${line.role}-${index}`}>
                  {line.text}
                </div>
              ))}
            </div>
            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                void send(draft);
              }}
            >
              <label>
                Ask for an ads change
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={3}
                  placeholder="Set budget of SOT Brand Defense to $40"
                />
              </label>
              <div className="row">
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? "Working…" : "Send"}
                </button>
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    className="btn-ghost"
                    type="button"
                    key={suggestion}
                    disabled={busy}
                    onClick={() => void send(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </form>
          </section>

          {pending.length ? (
            <section className="panel proposal">
              <h2>Confirm before it runs</h2>
              {pending.map((item) => (
                <ChallengeCard
                  key={item.id}
                  id={item.id}
                  summary={item.summary}
                  busy={busy}
                  onConfirm={confirm}
                  onCancel={reject}
                />
              ))}
            </section>
          ) : null}

          {latest?.result ? (
            <section className="panel">
              <h2>Result of the last change</h2>
              <p>{latest.result.summary}</p>
              <p className="muted">Mode: {latest.result.mode}</p>
              <pre>{JSON.stringify({ before: latest.result.before, after: latest.result.after }, null, 2)}</pre>
            </section>
          ) : null}

          <SkuDesk
            kits={workspace?.kits ?? []}
            sampleData={workspace?.sampleData !== false && workspace?.mode !== "live"}
          />

          <P0Toggles
            campaigns={workspace?.campaigns ?? []}
            busy={busy}
            caps={workspace?.caps ?? null}
            catalog={workspace?.catalog ?? []}
            sampleData={workspace?.sampleData !== false && workspace?.mode !== "live"}
            propose={propose}
          />

          <section className="panel">
            <h2>New campaign</h2>
            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                void propose({
                  type: "create_campaign",
                  name: newName,
                  dailyBudget: Number(newBudget),
                  targetingType: targeting,
                  state: newState,
                  kitId: newKit,
                });
              }}
            >
              <label>
                Kit
                <select value={newKit} onChange={(event) => setNewKit(event.target.value)}>
                  {(workspace?.catalog ?? []).map((kit) => (
                    <option key={kit.kitId} value={kit.kitId}>
                      {kit.name} · {kit.sku}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Name
                <input value={newName} onChange={(event) => setNewName(event.target.value)} />
              </label>
              <label>
                Daily budget
                <input value={newBudget} onChange={(event) => setNewBudget(event.target.value)} inputMode="decimal" />
              </label>
              <label>
                Targeting
                <select value={targeting} onChange={(event) => setTargeting(event.target.value)}>
                  <option value="MANUAL">MANUAL</option>
                  <option value="AUTO">AUTO</option>
                </select>
              </label>
              <label>
                Start state
                <select value={newState} onChange={(event) => setNewState(event.target.value)}>
                  <option value="PAUSED">PAUSED</option>
                  <option value="ENABLED">ENABLED</option>
                </select>
              </label>
              <button className="btn" type="submit" disabled={busy || !newName.trim()}>
                Prepare campaign
              </button>
            </form>
          </section>

          <FeedbackPanel checks={workspace?.checks ?? []} busy={busy} onRecord={recordResult} />

          <section className="panel">
            <h2>Audit log</h2>
            {workspace?.audit.length ? (
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Who</th>
                    <th>Status</th>
                    <th>Summary</th>
                    <th>Bet</th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.audit.map((event) => (
                    <tr key={event.id}>
                      <td>{event.at.slice(0, 19).replace("T", " ")}</td>
                      <td>{event.actorLabel}</td>
                      <td>{event.status}</td>
                      <td>{event.summary}</td>
                      <td>
                        {event.intent ? (
                          <>
                            {event.challengeStrength === "thin" ? "Thin. " : ""}
                            {event.intent}
                            {event.expected ? <div className="muted">{event.expected}</div> : null}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">No mutations yet. Refused attempts are recorded here too.</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
