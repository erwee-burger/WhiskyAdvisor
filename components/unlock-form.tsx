"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UnlockForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function renderButtonLabel(text: string, spinning: boolean) {
    if (!spinning) {
      return text;
    }

    return (
      <span className="button-content">
        <span className="button-spinner" aria-hidden="true" />
        {text}
      </span>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/auth/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, next: nextPath })
    });

    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string; redirectTo?: string }
      | null;

    setLoading(false);

    if (!response.ok || !payload?.ok) {
      setError(payload?.error ?? "Could not unlock access.");
      return;
    }

    router.replace(payload.redirectTo ?? "/");
    router.refresh();
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="access-token">Access token</label>
        <input
          autoFocus
          id="access-token"
          onChange={(event) => setToken(event.target.value)}
          placeholder="Enter token"
          type="password"
          value={token}
        />
      </div>
      <button className="button" disabled={loading || token.trim().length === 0} type="submit">
        {renderButtonLabel("Unlock", loading)}
      </button>
      {error ? <div className="status-note">{error}</div> : null}
    </form>
  );
}
