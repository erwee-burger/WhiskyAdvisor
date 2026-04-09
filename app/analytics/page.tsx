import { StatCard } from "@/components/stat-card";
import { getAnalytics } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const analytics = await getAnalytics();
  const safePeatProfile = Array.isArray(analytics?.peatProfile) ? analytics.peatProfile : [];
  const safeRegionSplit = Array.isArray(analytics?.regionSplit) ? analytics.regionSplit : [];
  const safeRatingDistribution = Array.isArray(analytics?.ratingDistribution)
    ? analytics.ratingDistribution
    : [];
  const safeTopDistilleries = Array.isArray(analytics?.topDistilleries) ? analytics.topDistilleries : [];
  const safeTopBottlers = Array.isArray(analytics?.topBottlers) ? analytics.topBottlers : [];
  const ratedBottlesCount = analytics.ratingDistribution.reduce((total, entry) => total + entry.count, 0);

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
          <StatCard label="Rated bottles" value={String(ratedBottlesCount)} />
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
            {safeRegionSplit.map((entry) => (
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
            {safePeatProfile.map((entry) => (
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
              <p>How your collection distributes across the 3-star scale.</p>
            </div>
          </div>
          <div className="card-list">
            {safeRatingDistribution.map((entry) => (
              <div className="advisor-card" key={entry.rating}>
                <strong>{"★".repeat(entry.rating)}{"☆".repeat(3 - entry.rating)} — {entry.label}</strong>
                <p className="muted">{entry.count} {entry.count === 1 ? "bottle" : "bottles"}</p>
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
            {safeTopDistilleries.map((entry) => (
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
            {safeTopBottlers.map((entry) => (
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
