import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Not Found</p>
        <h1>This whisky record does not exist.</h1>
        <p>The item may have been removed, or the draft was never saved into the collection.</p>
        <div className="hero-actions">
          <Link className="button" href="/collection">
            Back to collection
          </Link>
        </div>
      </section>
    </div>
  );
}
