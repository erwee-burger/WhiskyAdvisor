import Link from "next/link";

export default function ExportPage() {
  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Export</p>
        <h1>Take your collection with you.</h1>
        <p>
          Export the full collection including release details, tasting notes, and price snapshots in CSV
          or JSON.
        </p>
        <div className="hero-actions">
          <Link className="button" href="/api/export?format=csv">
            Download CSV
          </Link>
          <Link className="button-subtle" href="/api/export?format=json">
            Download JSON
          </Link>
        </div>
      </section>
    </div>
  );
}
