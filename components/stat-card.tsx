export function StatCard({
  label,
  value,
  hint,
  trend,
  trendDir,
  history,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Short trend string, e.g. "↑ 4 this month" */
  trend?: string;
  trendDir?: "up" | "down" | "neutral";
  /** Array of historical values (oldest → newest) used to draw a sparkline */
  history?: number[];
}) {
  const max = history && history.length > 0 ? Math.max(...history, 1) : 1;

  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        {history && history.length > 0 && (
          <div className="stat-sparkline" aria-hidden="true">
            {history.map((v, i) => (
              <span
                key={i}
                className={`stat-sparkline-bar${i === history.length - 1 ? " stat-sparkline-bar-hi" : ""}`}
                style={{ height: `${Math.max(12, Math.round((v / max) * 100))}%` }}
              />
            ))}
          </div>
        )}
      </div>
      <strong className="stat-value">{value}</strong>
      {trend ? (
        <p className={`stat-trend stat-trend-${trendDir ?? "neutral"}`}>{trend}</p>
      ) : hint ? (
        <p className="muted">{hint}</p>
      ) : null}
    </article>
  );
}
