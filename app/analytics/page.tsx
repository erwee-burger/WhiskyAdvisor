import { StatCard } from "@/components/stat-card";
import { getAnalytics } from "@/lib/repository";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const analytics = await getAnalytics();

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Analytics</p>
        <h1>See the shape of your whisky collection.</h1>
        <p>
          Understand where your shelf leans, how much smoke dominates it, who your favorite bottlers
          are, and how your paid prices compare to the market.
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
          <StatCard
            label="Avg bottle size"
            value={analytics.bottleProfile.averageVolumeMl ? `${analytics.bottleProfile.averageVolumeMl} ml` : "Not set"}
          />
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
              <div className="advisor-card" key={entry.peatLevel}>
                <strong>{entry.peatLevel}</strong>
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
            <h2>Value view</h2>
            <p>High-level spend and market range in ZAR.</p>
          </div>
        </div>
        <div className="stats-grid">
          <StatCard label="Paid total" value={formatCurrency(analytics.marketValue.paidTotalZar)} />
          <StatCard label="Market low" value={formatCurrency(analytics.marketValue.marketLowZar)} />
          <StatCard label="Market high" value={formatCurrency(analytics.marketValue.marketHighZar)} />
          <StatCard
            label="Potential swing"
            value={formatCurrency(analytics.marketValue.marketHighZar - analytics.marketValue.paidTotalZar)}
          />
        </div>
      </section>
    </div>
  );
}
