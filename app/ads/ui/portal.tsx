"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Campaign = {
  campaignId: string;
  name: string;
  state: "ENABLED" | "PAUSED";
  targetingType: "MANUAL" | "AUTO";
  dailyBudget: number;
  spend: number | null;
  sales: number | null;
  clicks: number | null;
  impressions: number | null;
  simulated: boolean;
  keywords: { keywordId: string; keywordText: string; matchType: string; bid: number; state: string }[];
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
};

type Workspace = {
  mode: "dry-run" | "live";
  spendOwner: string;
  account: string;
  connectHint: string;
  campaigns: Campaign[];
  proposals: Proposal[];
  audit: AuditEvent[];
};

type ChatLine = { role: "user" | "desk"; text: string };

const SUGGESTIONS = [
  "List campaigns and spend",
  "Pause SOT Sensory Chews",
  "Set budget of SOT Brand Defense to $40",
  "Add exact keyword sensory chew to SOT Brand Defense at $1.25",
];

export function AdsPortal({
  publishableKey,
  scriptSrc,
}: {
  publishableKey: string;
  scriptSrc: string;
}) {
  const signInRef = useRef<HTMLDivElement>(null);
  const userButtonRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<() => Promise<string | null>>(async () => null);
  const [phase, setPhase] = useState<"loading" | "signed-out" | "ready" | "error">("loading");
  const [bootError, setBootError] = useState("");
  const [allowDev, setAllowDev] = useState(false);
  const [devEntry, setDevEntry] = useState(false);
  const [who, setWho] = useState("");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([
    {
      role: "desk",
      text: "Amazon Advertising only. Spend on this account is Shakeel Amir’s. I will ask you to confirm before any campaign, keyword, or budget change.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [budget, setBudget] = useState("40");
  const [keyword, setKeyword] = useState("");
  const [matchType, setMatchType] = useState("EXACT");
  const [bid, setBid] = useState("1.25");
  const [newName, setNewName] = useState("");
  const [newBudget, setNewBudget] = useState("25");
  const [targeting, setTargeting] = useState("MANUAL");
  const [newState, setNewState] = useState("PAUSED");
  const [latest, setLatest] = useState<Proposal | null>(null);

  const authed = phase === "ready";

  const authHeaders = useCallback(async () => {
    const token = await tokenRef.current();
    if (!token) throw new Error("Sign in required.");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }, []);

  const refresh = useCallback(async () => {
    const headers = await authHeaders();
    const response = await fetch("/api/ads/workspace", { headers, cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Could not load campaigns.");
    setWorkspace(body);
    setCampaignId((current) => current || body.campaigns[0]?.campaignId || "");
  }, [authHeaders]);

  useEffect(() => {
    fetch("/api/ads/health")
      .then((response) => response.json())
      .then((body) => setAllowDev(Boolean(body.devBypass)))
      .catch(() => setAllowDev(false));
  }, []);

  useEffect(() => {
    if (devEntry) {
      tokenRef.current = async () => "dev";
      setWho("Local dev bypass");
      setPhase("ready");
      return;
    }
    let cancelled = false;
    const script = document.createElement("script");
    script.src = scriptSrc;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.clerkPublishableKey = publishableKey;
    script.onload = async () => {
      try {
        if (!window.Clerk) throw new Error("Clerk did not load.");
        await window.Clerk.load({ publishableKey });
        if (cancelled) return;
        const render = () => {
          if (!window.Clerk || cancelled) return;
          const user = window.Clerk.user;
          if (user) {
            tokenRef.current = async () => window.Clerk?.session?.getToken() ?? null;
            setWho(user.primaryEmailAddress?.emailAddress || user.fullName || user.id);
            setPhase("ready");
            if (userButtonRef.current && !userButtonRef.current.dataset.mounted) {
              window.Clerk.mountUserButton(userButtonRef.current);
              userButtonRef.current.dataset.mounted = "1";
            }
          } else {
            tokenRef.current = async () => null;
            setPhase("signed-out");
            const node = signInRef.current;
            if (node && !node.dataset.mounted) {
              window.Clerk.mountSignIn(node, {
                routing: "hash",
                signUpUrl: "/ads/invite-only",
                appearance: {
                  variables: {
                    colorBackground: "#121a2f",
                    colorText: "#e8eefc",
                    colorPrimary: "#7aa2ff",
                    colorInputBackground: "#0b1020",
                    colorInputText: "#e8eefc",
                  },
                },
              });
              node.dataset.mounted = "1";
            }
          }
        };
        window.Clerk.addListener(render);
        render();
      } catch (err) {
        if (!cancelled) {
          setPhase("error");
          setBootError(err instanceof Error ? err.message : "Auth failed to load.");
        }
      }
    };
    script.onerror = () => {
      setPhase("error");
      setBootError("Clerk could not be loaded. Allow this site origin in the Clerk dashboard.");
    };
    document.body.appendChild(script);
    return () => {
      cancelled = true;
    };
  }, [devEntry, publishableKey, scriptSrc]);

  useEffect(() => {
    if (!authed) return;
    refresh().catch((err: unknown) => setError(err instanceof Error ? err.message : "Load failed."));
  }, [authed, refresh]);

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

  async function resolve(id: string, decision: "confirm" | "reject") {
    setBusy(true);
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`/api/ads/proposals/${id}/${decision}`, { method: "POST", headers });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not update that change.");
      if (decision === "confirm") setLatest(body.proposal);
      setLines((current) => [
        ...current,
        {
          role: "desk",
          text:
            decision === "confirm"
              ? body.proposal.result?.summary || body.proposal.summary
              : `Cancelled. ${body.proposal.summary}`,
        },
      ]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update that change.");
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

  if (!authed) {
    return (
      <main className="gate">
        <section className="gate-card">
          <p className="eyebrow">Sensationally OT · Invite only</p>
          <h1>Amazon Ads desk</h1>
          <p className="muted">
            Offshore consultant access for Shakeel Amir’s Amazon Advertising account. Sign in with the
            email Shak invited. Public sign-up is not offered here.
          </p>
          {phase === "loading" ? <p className="muted">Loading sign-in…</p> : null}
          {phase === "error" ? <p className="muted">{bootError}</p> : null}
          <div id="sign-in" ref={signInRef} />
          <p className="muted">
            Need an invite? <a href="/ads/invite-only">How invitations work</a>
          </p>
          {allowDev ? (
            <button className="btn-ghost" type="button" onClick={() => setDevEntry(true)}>
              Enter local simulator
            </button>
          ) : null}
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
          <div ref={userButtonRef} />
          {devEntry ? (
            <button className="btn-ghost" type="button" onClick={() => window.location.reload()}>
              Leave simulator
            </button>
          ) : null}
        </div>
      </header>

      <section className="banner">
        <strong>Spend is {workspace?.spendOwner ?? "Shakeel Amir"}’s.</strong>{" "}
        <span className="muted">
          {workspace?.connectHint}{" "}
          <span className={workspace?.mode === "live" ? "pill live" : "pill sim"}>
            {workspace?.mode === "live" ? "Live Ads API" : "Simulated"}
          </span>
        </span>
      </section>

      {error ? <p className="banner">{error}</p> : null}

      <div className="grid">
        <aside className="stack">
          <section className="panel">
            <h2>Allowed</h2>
            <ul className="deny">
              <li>Create and modify campaigns</li>
              <li>Change keywords, bids, and match types</li>
              <li>Set daily budgets</li>
              <li>Turn campaigns on or off</li>
              <li>Export CSV and read the audit log</li>
            </ul>
          </section>
          <section className="panel">
            <h2>Refused</h2>
            <ul className="deny">
              <li>Wipe or delete account history</li>
              <li>Bulk delete campaigns or delete everything</li>
              <li>Billing or payment changes</li>
              <li>Listings, inventory, Seller Central</li>
              <li>Other bots or general chat</li>
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
                <div key={item.id} className="stack" style={{ marginBottom: "0.8rem" }}>
                  <strong>{item.summary}</strong>
                  <div className="row">
                    <button className="btn" type="button" disabled={busy} onClick={() => resolve(item.id, "confirm")}>
                      Confirm — {item.summary}
                    </button>
                    <button className="btn-bad" type="button" disabled={busy} onClick={() => resolve(item.id, "reject")}>
                      Cancel
                    </button>
                  </div>
                </div>
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

          <section className="panel">
            <h2>Campaigns</h2>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>State</th>
                  <th>Budget</th>
                  <th>Spend</th>
                  <th>Sales</th>
                </tr>
              </thead>
              <tbody>
                {workspace?.campaigns.map((campaign) => (
                  <tr key={campaign.campaignId}>
                    <td>
                      {campaign.name}
                      <div className="muted">{campaign.campaignId}</div>
                    </td>
                    <td>{campaign.state}</td>
                    <td>${campaign.dailyBudget.toFixed(2)}</td>
                    <td>{campaign.spend == null ? "—" : `$${campaign.spend.toFixed(2)}`}</td>
                    <td>{campaign.sales == null ? "—" : `$${campaign.sales.toFixed(2)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <form
              className="stack"
              style={{ marginTop: "0.9rem" }}
              onSubmit={(event) => {
                event.preventDefault();
                void propose({
                  type: "set_budget",
                  campaignId,
                  dailyBudget: Number(budget),
                });
              }}
            >
              <label>
                Campaign
                <select value={campaignId} onChange={(event) => setCampaignId(event.target.value)}>
                  {workspace?.campaigns.map((campaign) => (
                    <option key={campaign.campaignId} value={campaign.campaignId}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Daily budget (USD)
                <input value={budget} onChange={(event) => setBudget(event.target.value)} inputMode="decimal" />
              </label>
              <div className="row">
                <button className="btn" type="submit" disabled={busy || !campaignId}>
                  Prepare budget change
                </button>
                <button
                  className="btn-warn"
                  type="button"
                  disabled={busy || !campaignId}
                  onClick={() =>
                    void propose({ type: "set_campaign_state", campaignIds: [campaignId], state: "PAUSED" })
                  }
                >
                  Prepare pause
                </button>
                <button
                  className="btn-ghost"
                  type="button"
                  disabled={busy || !campaignId}
                  onClick={() =>
                    void propose({ type: "set_campaign_state", campaignIds: [campaignId], state: "ENABLED" })
                  }
                >
                  Prepare enable
                </button>
              </div>
            </form>
          </section>

          <section className="panel">
            <h2>Keyword</h2>
            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                void propose({
                  type: "upsert_keywords",
                  campaignId,
                  keywords: [
                    {
                      keywordText: keyword,
                      matchType,
                      bid: Number(bid),
                      state: "ENABLED",
                      negative: false,
                    },
                  ],
                });
              }}
            >
              <label>
                Keyword
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
              <button className="btn" type="submit" disabled={busy || !campaignId || !keyword.trim()}>
                Prepare keyword change
              </button>
            </form>
          </section>

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
                });
              }}
            >
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
                  </tr>
                </thead>
                <tbody>
                  {workspace.audit.map((event) => (
                    <tr key={event.id}>
                      <td>{event.at.slice(0, 19).replace("T", " ")}</td>
                      <td>{event.actorLabel}</td>
                      <td>{event.status}</td>
                      <td>{event.summary}</td>
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
