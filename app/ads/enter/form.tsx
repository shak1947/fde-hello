"use client";

import { useState } from "react";

export function PasswordForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ads/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setPassword("");
      if (!response.ok) {
        setError(body.error || "Wrong password.");
        return;
      }
      window.location.assign("/ads");
    } catch {
      setPassword("");
      setError("Could not reach the sign-in service.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <label>
        Password
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      {error ? <p className="banner">{error}</p> : null}
      <button className="btn" type="submit" disabled={busy}>
        {busy ? "Checking…" : "Open the desk"}
      </button>
    </form>
  );
}
