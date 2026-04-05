"use client";

import { useState, useTransition } from "react";

type CompareOption = {
  itemId: string;
  expressionId: string;
  label: string;
  subtitle: string;
};

type CompareResult = {
  rows: Array<{ label: string; left: string; right: string }>;
  summary: string;
  palateFit: { left: string; right: string };
};

export function CompareForm({ options }: { options: CompareOption[] }) {
  const [result, setResult] = useState<CompareResult | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleCompare(formData: FormData) {
    const leftId = String(formData.get("leftId") ?? "");
    const rightId = String(formData.get("rightId") ?? "");

    if (!leftId || !rightId) {
      setMessage("Pick two whiskies to compare.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leftId, rightId })
      });

      if (!response.ok) {
        setMessage("Comparison failed.");
        return;
      }

      setResult((await response.json()) as CompareResult);
      setMessage("");
    });
  }

  return (
    <div className="grid columns-2">
      <section className="panel stack">
        <div className="section-title">
          <div>
            <h2>Compare whiskies</h2>
            <p>Compare saved bottles or expressions side by side.</p>
          </div>
        </div>
        <form action={handleCompare} className="stack">
          <div className="field">
            <label htmlFor="leftId">Left whisky</label>
            <select id="leftId" name="leftId">
              {options.map((option) => (
                <option key={`left-${option.itemId}`} value={option.itemId}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rightId">Right whisky</label>
            <select id="rightId" name="rightId">
              {options.map((option) => (
                <option key={`right-${option.itemId}`} value={option.itemId}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button className="button" disabled={isPending} type="submit">
            Run comparison
          </button>
        </form>
        {message ? <div className="status-note">{message}</div> : null}
      </section>
      <section className="panel stack">
        <div className="section-title">
          <div>
            <h2>Comparison output</h2>
            <p>Structured side-by-side analysis with palate commentary.</p>
          </div>
        </div>
        {result ? (
          <>
            <div className="table-wrap">
              <table>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.label}>
                      <th>{row.label}</th>
                      <td>{row.left}</td>
                      <td>{row.right}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="compare-card">
              <h3>Summary</h3>
              <p>{result.summary}</p>
              <p className="muted">Left fit: {result.palateFit.left}</p>
              <p className="muted">Right fit: {result.palateFit.right}</p>
            </div>
          </>
        ) : (
          <div className="empty-state">
            Pick two whiskies and run a comparison to see specs, style cues, pricing context, and palate fit.
          </div>
        )}
      </section>
    </div>
  );
}
