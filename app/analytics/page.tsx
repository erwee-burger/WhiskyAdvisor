import Link from "next/link";

import { StatCard } from "@/components/stat-card";
import { getAnalytics } from "@/lib/repository";

export const dynamic = "force-dynamic";

function collectionLink(filterType: string, filterValue: string) {
  return `/collection?filterType=${encodeURIComponent(filterType)}&filterValue=${encodeURIComponent(filterValue)}`;
}

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

  const topRegion = analytics.regionSplit[0]?.region;
  const topPeat = analytics.peatProfile[0]?.tag;
  const topDistillery = analytics.topDistilleries[0]?.name;
  const topBottler = analytics.topBottlers[0]?.name;

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
              <Link className="advisor-card advisor-card--link" href={collectionLink("region", entry.region)} key={entry.region}>
                <strong>{entry.region}</strong>
                <p className="muted">{entry.count} bottles</p>
              </Link>
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
              <Link className="advisor-card advisor-card--link" href={collectionLink("peat", entry.tag)} key={entry.tag}>
                <strong>{entry.tag}</strong>
                <p className="muted">{entry.count} bottles</p>
              </Link>
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
              <Link className="advisor-card advisor-card--link" href={collectionLink("rating", String(entry.rating))} key={entry.rating}>
                <strong>{"★".repeat(entry.rating)}{"☆".repeat(3 - entry.rating)} — {entry.label}</strong>
                <p className="muted">{entry.count} {entry.count === 1 ? "bottle" : "bottles"}</p>
              </Link>
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
              <Link className="advisor-card advisor-card--link" href={collectionLink("distillery", entry.name)} key={entry.name}>
                <strong>{entry.name}</strong>
                <p className="muted">{entry.count} bottles</p>
              </Link>
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
              <Link className="advisor-card advisor-card--link" href={collectionLink("bottler", entry.name)} key={entry.name}>
                <strong>{entry.name}</strong>
                <p className="muted">{entry.count} bottles</p>
              </Link>
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
          <StatCard
            label="Top region"
            value={topRegion ?? "None yet"}
            href={topRegion ? collectionLink("region", topRegion) : undefined}
          />
          <StatCard
            label="Top peat"
            value={topPeat ?? "None yet"}
            href={topPeat ? collectionLink("peat", topPeat) : undefined}
          />
          <StatCard
            label="Top distillery"
            value={topDistillery ?? "None yet"}
            href={topDistillery ? collectionLink("distillery", topDistillery) : undefined}
          />
          <StatCard
            label="Top bottler"
            value={topBottler ?? "None yet"}
            href={topBottler ? collectionLink("bottler", topBottler) : undefined}
          />
        </div>
      </section>
    </div>
  );
}
