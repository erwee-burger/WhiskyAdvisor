export default function Loading() {
  return (
    <div className="page page-loading">
      <section className="hero">
        <div className="loading-hero">
          <span className="loading-spinner" aria-hidden="true" />
          <div>
            <p className="eyebrow">Loading</p>
            <h1>Bringing your whisky cellar into view.</h1>
            <p>Fetching collection data, pricing, and your latest notes.</p>
          </div>
        </div>
      </section>

      <section className="panel stack">
        <div className="section-title">
          <div>
            <h2>Loading collection</h2>
            <p>Please wait while the shelf is assembled.</p>
          </div>
        </div>
        <div className="loading-grid">
          <div className="loading-card" />
          <div className="loading-card" />
          <div className="loading-card" />
          <div className="loading-card" />
        </div>
      </section>
    </div>
  );
}
