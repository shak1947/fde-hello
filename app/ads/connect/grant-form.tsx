"use client";

import { useState, type FormEvent } from "react";

export function GrantForm() {
  const [setupKey, setSetupKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function start(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ads/oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupKey }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Owner grant could not start.");
      if (typeof body.authorizeUrl !== "string" || !body.authorizeUrl.startsWith("https://")) {
        throw new Error("Amazon did not return an authorization URL.");
      }
      window.location.assign(body.authorizeUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Owner grant could not start.");
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={(event) => void start(event)}>
      <label>
        Owner setup key
        <input
          type="password"
          autoComplete="off"
          value={setupKey}
          onChange={(event) => setSetupKey(event.target.value)}
        />
      </label>
      <button className="btn" type="submit" disabled={busy || setupKey.length < 8}>
        {busy ? "Opening Amazon…" : "Continue to Amazon"}
      </button>
      {error ? <p className="muted">{error}</p> : null}
    </form>
  );
}
