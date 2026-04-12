"use client";

import { useState } from "react";
import type { NewsBudgetPreferences } from "@/lib/types";

interface Props {
  currentPreferences: NewsBudgetPreferences;
  onSave: (prefs: NewsBudgetPreferences) => void;
}

export function NewsPreferencesPanel({ currentPreferences, onSave }: Props) {
  const [softCap, setSoftCap] = useState(String(currentPreferences.softBudgetCapZar));
  const [stretchCap, setStretchCap] = useState(
    currentPreferences.stretchBudgetCapZar !== null
      ? String(currentPreferences.stretchBudgetCapZar)
      : ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const softNum = Number(softCap);
    if (!softCap || isNaN(softNum) || softNum <= 0) {
      setError("Soft budget must be a positive number.");
      return;
    }

    const stretchNum = stretchCap.trim() === "" ? null : Number(stretchCap);
    if (stretchCap.trim() !== "" && (isNaN(stretchNum!) || stretchNum! <= 0)) {
      setError("Stretch cap must be a positive number or blank.");
      return;
    }

    const payload: NewsBudgetPreferences = {
      softBudgetCapZar: softNum,
      stretchBudgetCapZar: stretchNum
    };

    setIsSaving(true);
    try {
      await onSave(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="prefs-panel" onSubmit={handleSave}>
      <div className="field">
        <label htmlFor="soft-cap">Soft budget cap</label>
        <input
          id="soft-cap"
          type="number"
          min="1"
          step="1"
          value={softCap}
          onChange={e => setSoftCap(e.target.value)}
        />
        <span className="field-hint">Items above this are flagged as a stretch.</span>
      </div>

      <div className="field">
        <label htmlFor="stretch-cap">Stretch cap (optional)</label>
        <input
          id="stretch-cap"
          type="number"
          min="1"
          step="1"
          value={stretchCap}
          placeholder="No ceiling"
          onChange={e => setStretchCap(e.target.value)}
        />
        <span className="field-hint">Leave blank to see everything, regardless of price.</span>
      </div>

      {error && <p style={{ color: "var(--danger)", fontSize: "0.88rem" }}>{error}</p>}

      <button type="submit" className="button" disabled={isSaving}>
        {isSaving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
