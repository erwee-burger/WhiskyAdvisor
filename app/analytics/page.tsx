import { StatCard } from "@/components/stat-card";
import { getAnalytics } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const analytics = await getAnalytics();
  const tastingNotesCount = analytics.ratingDistribution.reduce((total, entry) => total + entry.count, 0);

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Analytics</p>
        <h1>See the shape of your whisky collection.</h1>
        <p>
          Understand where your shelf leans, how much smoke dominates it, who your favorite bottlers
          are, and which tags and regions keep surfacing in your collection.
        </p>
      </section>

      <section className="panel">
        <div className="stats-grid">
          <StatCard label="Owned" value={String(analytics.totals.owned)} />
          <StatCard label="Wishlist" value={String(analytics.totals.wishlist)} />
          <StatCard label="Open" value={String(analytics.totals.open)} />
          <StatCard label="Finished" value={String(analytics.totals.finished)} />
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Bottle profile</h2>
            <p>New schema fields surfaced as shelf-level signals.</p>
          </div>
        </div>
        <div className="stats-grid">
          <StatCard label="Brand tagged" value={String(analytics.bottleProfile.brandTagged)} />
          <StatCard label="NAS" value={String(analytics.bottleProfile.nas)} />
          <StatCard label="Limited" value={String(analytics.bottleProfile.limited)} />
          <StatCard label="Chill filtered" value={String(analytics.bottleProfile.chillFiltered)} />
          <StatCard label="Natural color" value={String(analytics.bottleProfile.naturalColor)} />
          <StatCard label="Tasting notes" value={String(tastingNotesCount)} />
        </div>
      </section>

      <section className="grid columns-3">
        <div className="panel stack">
          <div className="section-title">
            <div>
              <h2>Region split</h2>
              <p>Where your shelf currently lives.</p>
            </div>
          </div>
          <div className="card-list">
            {analytics.regionSplit.map((entry) => (
              <div className="advisor-card" key={entry.region}>
                <strong>{entry.region}</strong>
                <p className="muted">{entry.count} bottles</p>
              </div>
            ))}
          </div>
        </div>
        <div className="panel stack">
          <div className="section-title">
            <div>
              <h2>Peat profile</h2>
              <p>What level of smoke dominates your shelf.</p>
            </div>
          </div>
          <div className="card-list">
            {analytics.peatProfile.map((entry) => (
              <div className="advisor-card" key={entry.tag}>
                <strong>{entry.tag}</strong>
                <p className="muted">{entry.count} bottles</p>
              </div>
            ))}
          </div>
        </div>
        <div className="panel stack">
          <div className="section-title">
            <div>
              <h2>Ratings</h2>
              <p>How your tasting history distributes.</p>
            </div>
          </div>
          <div className="card-list">
            {analytics.ratingDistribution.map((entry) => (
              <div className="advisor-card" key={entry.rating}>
                <strong>{entry.rating}/5</strong>
                <p className="muted">{entry.count} tasting notes</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid columns-2">
        <div className="panel stack">
          <div className="section-title">
            <div>
              <h2>Top distilleries</h2>
              <p>The distilleries most represented in your owned bottles.</p>
            </div>
          </div>
          <div className="card-list">
            {analytics.topDistilleries.map((entry) => (
              <div className="advisor-card" key={entry.name}>
                <strong>{entry.name}</strong>
                <p className="muted">{entry.count} bottles</p>
              </div>
            ))}
          </div>
        </div>
        <div className="panel stack">
          <div className="section-title">
            <div>
              <h2>Top bottlers</h2>
              <p>Official and independent releases both count here.</p>
            </div>
          </div>
          <div className="card-list">
            {analytics.topBottlers.map((entry) => (
              <div className="advisor-card" key={entry.name}>
                <strong>{entry.name}</strong>
                <p className="muted">{entry.count} bottles</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Shelf leaders</h2>
            <p>The most common anchors in your current collection.</p>
          </div>
        </div>
        <div className="stats-grid">
          <StatCard label="Top region" value={analytics.regionSplit[0]?.region ?? "None yet"} />
          <StatCard label="Top peat" value={analytics.peatProfile[0]?.tag ?? "None yet"} />
          <StatCard label="Top distillery" value={analytics.topDistilleries[0]?.name ?? "None yet"} />
          <StatCard label="Top bottler" value={analytics.topBottlers[0]?.name ?? "None yet"} />
        </div>
      </section>
    </div>
  );
}
