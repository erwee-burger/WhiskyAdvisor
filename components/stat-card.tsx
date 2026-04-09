import Link from "next/link";

export function StatCard({ label, value, hint, href }: { label: string; value: string; hint?: string; href?: string }) {
  if (href) {
    return (
      <Link className="stat-card stat-card--link" href={href}>
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
        {hint ? <p className="muted">{hint}</p> : null}
      </Link>
    );
  }
  return (
    <article className="stat-card">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {hint ? <p className="muted">{hint}</p> : null}
    </article>
  );
}
