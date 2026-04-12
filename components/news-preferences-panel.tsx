// components/news-preferences-panel.tsx
"use client";

import { useState } from "react";
import type { NewsBudgetPreferences } from "@/lib/types";

interface Props {
  initialPreferences: NewsBudgetPreferences;
  onSaved: (prefs: NewsBudgetPreferences) => void;
}

export function NewsPreferencesPanel({ initialPreferences, onSaved }: Props) {
  const [softCap, setSoftCap] = useState(String(initialPreferences.softBudgetCapZar));
  const [stretchCap, setStretchCap] = useState(
    initialPreferences.stretchBudgetCapZar !== null
      ? String(initialPreferences.stretchBudgetCapZar)
      : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const softNum = Number(softCap);
    if (!softCap || isNaN(softNum) || softNum <= 0) {
      setError("Normal budget cap must be a positive number.");
      return;
    }

    // Blank stretch cap is valid — send null
    const stretchNum = stretchCap.trim() === "" ? null : Number(stretchCap);
    if (stretchCap.trim() !== "" && (isNaN(stretchNum!) || stretchNum! <= 0)) {
      setError("Stretch cap must be a positive number or left blank.");
      return;
    }

    const payload: NewsBudgetPreferences = {
      softBudgetCapZar:    softNum,
      stretchBudgetCapZar: stretchNum
    };

    setSaving(true);
    try {
      const res = await fetch("/api/news/preferences", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload)
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      onSaved(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="news-preferences-panel" onSubmit={handleSave}>
      <h3 className="news-preferences-panel__heading">Budget preferences</h3>

      <div className="news-preferences-panel__field">
        <label htmlFor="soft-cap" className="news-preferences-panel__label">
          Normal budget cap (R)
        </label>
        <input
          id="soft-cap"
          type="number"
          min="1"
          step="1"
          className="news-preferences-panel__input"
          value={softCap}
          onChange={e => setSoftCap(e.target.value)}
        />
      </div>

      <div className="news-preferences-panel__field">
        <label htmlFor="stretch-cap" className="news-preferences-panel__label">
          Stretch cap (R) <span className="news-preferences-panel__optional">optional</span>
        </label>
        <input
          id="stretch-cap"
          type="number"
          min="1"
          step="1"
          className="news-preferences-panel__input"
          value={stretchCap}
          placeholder="No limit"
          onChange={e => setStretchCap(e.target.value)}
        />
      </div>

      {error && <p className="news-preferences-panel__error">{error}</p>}
      {saved && <p className="news-preferences-panel__saved">Saved.</p>}

      <button
        type="submit"
        className="news-preferences-panel__save"
        disabled={saving}
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
