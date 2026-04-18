import type { FlavorPillar } from "@/lib/types";
import { getAnalytics } from "@/lib/repository";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PILLAR_LABELS: Record<FlavorPillar, string> = {
  smoky: "Smoke",
  sweet: "Sweet",
  spicy: "Spice",
  fruity: "Fruit",
  oaky: "Oak",
  floral: "Floral",
  malty: "Malt",
  coastal: "Coastal"
};

function formatValue(value: number | null, suffix = "") {
  if (value === null) {
    return "Not enough data";
  }

  return `${value}${suffix}`;
}

function MetricTile({
  label,
  value,
  supporting
}: {
  label: string;
  value: string;
  supporting?: string;
}) {
  return (
    <article className="analytics-metric-tile">
      <span className="analytics-metric-label">{label}</span>
      <strong className="analytics-metric-value">{value}</strong>
      {supporting ? <p>{supporting}</p> : null}
    </article>
  );
}

function DistributionList({
  title,
  subtitle,
  items,
  emptyText
}: {
  title: string;
  subtitle: string;
  items: Array<{ label: string; value: number; supporting?: string }>;
  emptyText: string;
}) {
  return (
    <section className="panel stack analytics-subpanel">
      <div className="section-title">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>
      {items.length > 0 ? (
        <div className="analytics-distribution-list">
          {items.map((item, index) => (
            <div className="analytics-distribution-row" key={`${item.label}-${index}`}>
              <div className="analytics-distribution-copy">
                <strong>{item.label}</strong>
                {item.supporting ? <p>{item.supporting}</p> : null}
              </div>
              <div className="analytics-distribution-meter">
                <span
                  className="analytics-distribution-fill"
                  style={{ width: `${Math.max(6, Math.min(item.value, 100))}%` }}
                />
              </div>
              <span className="analytics-distribution-value">{item.value}%</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="status-note status-note-info">{emptyText}</div>
      )}
    </section>
  );
}

export default async function AnalyticsPage() {
  const analytics = await getAnalytics();
  const topPillar = analytics.tasteIdentity.strongestPillars[0];
  const weakPillar = analytics.tasteIdentity.weakestPillars[0];

  return (
    <div className="page">
      <section className="hero analytics-hero">
        <p className="eyebrow">Analytics</p>
        <h1>Read the taste identity of your shelf.</h1>
        <p>
          This page should explain what your collection says about how you drink, where the
          concentration sits, and what the next blind spots are likely to be.
        </p>
      </section>

      <section className="panel analytics-summary-panel">
        <div className="analytics-summary-copy">
          <span className="pill">Taste identity</span>
          <h2>{analytics.tasteIdentity.dominantSummary}</h2>
          <p>
            {analytics.tasteIdentity.profileCoverage.profiledOwnedCount} of{" "}
            {analytics.tasteIdentity.profileCoverage.totalOwnedCount} owned bottles are flavor-profiled.
            The page below weighs that flavor signal against ratings, cask mix, and shelf concentration.
          </p>
        </div>
        <div className="analytics-metric-band">
          <MetricTile label="Owned" supporting="Bottles currently on shelf" value={String(analytics.totals.owned)} />
          <MetricTile label="Wishlist" supporting="Targets still outside the shelf" value={String(analytics.totals.wishlist)} />
          <MetricTile label="Rated" supporting="Owned bottles with a rating" value={String(analytics.ratingsInsight.ratedCount)} />
          <MetricTile label="Favorites" supporting="3-star bottles marked favorite" value={String(analytics.ratingsInsight.favoriteCount)} />
          <MetricTile
            label="Average rating"
            supporting="Across rated owned bottles"
            value={formatValue(analytics.ratingsInsight.averageRating, "/3")}
          />
          <MetricTile
            label="Average spend"
            supporting="Average paid per owned bottle"
            value={
              analytics.spendInsight.averageOwnedBottlePriceZar === null
                ? "Not saved"
                : formatCurrency(analytics.spendInsight.averageOwnedBottlePriceZar)
            }
          />
        </div>
      </section>

      <section className="grid columns-2 analytics-main-grid">
        <section className="panel stack analytics-feature-panel">
          <div className="section-title">
            <div>
              <h2>Flavor identity</h2>
              <p>The strongest shared sensory shape across your profiled shelf.</p>
            </div>
          </div>
          <div className="analytics-flavor-hero">
            <div className="analytics-flavor-highlights">
              <article className="analytics-highlight-card">
                <span className="analytics-highlight-label">Strongest</span>
                <strong>{topPillar ? `${PILLAR_LABELS[topPillar.pillar]} ${topPillar.value}/10` : "No profiles yet"}</strong>
              </article>
              <article className="analytics-highlight-card">
                <span className="analytics-highlight-label">Lightest</span>
                <strong>{weakPillar ? `${PILLAR_LABELS[weakPillar.pillar]} ${weakPillar.value}/10` : "No profiles yet"}</strong>
              </article>
              <article className="analytics-highlight-card">
                <span className="analytics-highlight-label">Coverage</span>
                <strong>{analytics.tasteIdentity.profileCoverage.percent}% profiled</strong>
              </article>
            </div>

            <div className="analytics-flavor-balance">
              {analytics.tasteIdentity.strongestPillars.map((entry) => (
                <div className="analytics-flavor-row" key={entry.pillar}>
                  <span>{PILLAR_LABELS[entry.pillar]}</span>
                  <div className="analytics-flavor-track">
                    <span
                      className="analytics-flavor-fill"
                      style={{ width: `${Math.max(4, entry.value * 10)}%` }}
                    />
                  </div>
                  <strong>{entry.value}/10</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="analytics-note-cluster">
            <h3>Recurring top notes</h3>
            {analytics.tasteIdentity.topNotes.length > 0 ? (
              <div className="pill-row">
                {analytics.tasteIdentity.topNotes.map((entry) => (
                  <span className="pill" key={entry.note}>
                    {entry.note} · {entry.count}
                  </span>
                ))}
              </div>
            ) : (
              <div className="status-note status-note-info">
                Profile more bottles to unlock recurring note rollups here.
              </div>
            )}
          </div>
        </section>

        <section className="panel stack analytics-shape-panel">
          <div className="section-title">
            <div>
              <h2>Identity snapshot</h2>
              <p>Where the collection leans when taste, ratings, and money are taken together.</p>
            </div>
          </div>
          <div className="analytics-kpi-stack">
            <article className="analytics-kpi-card">
              <span className="analytics-highlight-label">Favorite rate</span>
              <strong>{analytics.ratingsInsight.favoriteRate}%</strong>
              <p>Of rated owned bottles end up becoming favorites.</p>
            </article>
            <article className="analytics-kpi-card">
              <span className="analytics-highlight-label">Unrated owned</span>
              <strong>{analytics.ratingsInsight.unratedOwnedCount}</strong>
              <p>Owned bottles still missing direct preference signal.</p>
            </article>
            <article className="analytics-kpi-card">
              <span className="analytics-highlight-label">Median paid</span>
              <strong>
                {analytics.spendInsight.medianOwnedBottlePriceZar === null
                  ? "Not saved"
                  : formatCurrency(analytics.spendInsight.medianOwnedBottlePriceZar)}
              </strong>
              <p>Useful anchor against one-off expensive outliers.</p>
            </article>
          </div>
          <div className="analytics-inline-list">
            <article className="analytics-inline-card">
              <strong>Top rated regions</strong>
              <p>
                {analytics.ratingsInsight.topRatedRegions.length > 0
                  ? analytics.ratingsInsight.topRatedRegions.map((entry) => `${entry.region} (${entry.count})`).join(", ")
                  : "No strong rated-region pattern yet."}
              </p>
            </article>
            <article className="analytics-inline-card">
              <strong>Top rated cask styles</strong>
              <p>
                {analytics.ratingsInsight.topRatedCaskStyles.length > 0
                  ? analytics.ratingsInsight.topRatedCaskStyles.map((entry) => `${entry.label} (${entry.count})`).join(", ")
                  : "No strong rated cask-style pattern yet."}
              </p>
            </article>
            <article className="analytics-inline-card">
              <strong>Spend footprint</strong>
              <p>{formatCurrency(analytics.spendInsight.paidTotalZar)} captured in paid owned bottles.</p>
            </article>
          </div>
        </section>
      </section>

      <section className="grid columns-2 analytics-shelf-grid">
        <DistributionList
          emptyText="Add more owned bottles to show a regional mix."
          items={analytics.regionSplit.slice(0, 5).map((entry) => ({
            label: entry.region,
            supporting: `${entry.count} bottles`,
            value: Math.round((entry.count / Math.max(1, analytics.totals.owned)) * 100)
          }))}
          subtitle="This is not just where bottles come from, but how concentrated your shelf really is."
          title="Region mix"
        />
        <DistributionList
          emptyText="Save more tags to show cask-style mix."
          items={analytics.collectionShape.caskStyles.slice(0, 5).map((entry) => ({
            label: entry.label,
            supporting: `${entry.count} bottles`,
            value: Math.round(entry.share)
          }))}
          subtitle="Structural style mix says a lot about what kinds of maturation you keep returning to."
          title="Cask-style mix"
        />
      </section>

      <section className="grid columns-3 analytics-shape-cards">
        <article className="panel stack analytics-shape-card">
          <div className="section-title">
            <div>
              <h3>Peat mix</h3>
              <p>How much smoke concentration defines the shelf.</p>
            </div>
          </div>
          <div className="analytics-mini-list">
            {analytics.collectionShape.peatLevels.map((entry) => (
              <div className="analytics-mini-row" key={entry.tag}>
                <strong>{entry.label}</strong>
                <span>{entry.count} bottles · {entry.share}%</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel stack analytics-shape-card">
          <div className="section-title">
            <div>
              <h3>Concentration</h3>
              <p>Whether the shelf is broad or clustered around a few anchors.</p>
            </div>
          </div>
          <div className="analytics-mini-list">
            <div className="analytics-mini-row">
              <strong>Top region share</strong>
              <span>{analytics.collectionShape.topRegionShare}%</span>
            </div>
            <div className="analytics-mini-row">
              <strong>Top distillery share</strong>
              <span>{analytics.collectionShape.topDistilleryShare}%</span>
            </div>
            <div className="analytics-mini-row">
              <strong>IB vs official</strong>
              <span>
                {analytics.collectionShape.independentVsOfficial.independent} / {analytics.collectionShape.independentVsOfficial.official}
              </span>
            </div>
          </div>
        </article>

        <article className="panel stack analytics-shape-card">
          <div className="section-title">
            <div>
              <h3>Shelf anchors</h3>
              <p>The names that keep surfacing in the collection.</p>
            </div>
          </div>
          <div className="analytics-mini-list">
            <div className="analytics-mini-row">
              <strong>Top distillery</strong>
              <span>{analytics.topDistilleries[0]?.name ?? "None yet"}</span>
            </div>
            <div className="analytics-mini-row">
              <strong>Top bottler</strong>
              <span>{analytics.topBottlers[0]?.name ?? "None yet"}</span>
            </div>
            <div className="analytics-mini-row">
              <strong>Natural colour</strong>
              <span>{analytics.bottleProfile.naturalColor} owned bottles</span>
            </div>
          </div>
        </article>
      </section>

      <section className="panel stack analytics-blindspot-panel">
        <div className="section-title">
          <div>
            <h2>Blind spots and prompts</h2>
            <p>Moderate next-step signals drawn from balance, concentration, and what your ratings imply.</p>
          </div>
        </div>
        {analytics.blindSpots.length > 0 ? (
          <div className="grid columns-2 analytics-blindspot-grid">
            {analytics.blindSpots.map((entry) => (
              <article className={`analytics-blindspot-card analytics-blindspot-${entry.tone}`} key={entry.title}>
                <span className="pill">{entry.tone}</span>
                <h3>{entry.title}</h3>
                <p>{entry.detail}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="status-note status-note-info">
            The shelf is still broad enough that no strong blind spots stand out yet.
          </div>
        )}
      </section>
    </div>
  );
}
