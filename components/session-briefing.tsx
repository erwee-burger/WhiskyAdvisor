"use client";

import type { Briefing } from "@/lib/types";

export function SessionBriefing({ briefing }: { briefing: Briefing }) {
  return (
    <div className="session-briefing">
      {briefing.tastingOrder.length > 0 && (
        <div className="session-briefing-section">
          <h5>Pour Order</h5>
          <ol className="session-briefing-order">
            {briefing.tastingOrder.map((entry, i) => (
              <li key={i}>
                <strong>{entry.bottleName}</strong>
                <p>{entry.reason}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
      {briefing.tips.length > 0 && (
        <div className="session-briefing-section">
          <h5>Tasting Tips</h5>
          <ul className="session-briefing-tips">
            {briefing.tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
