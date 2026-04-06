import Link from "next/link";

import { AdvisorCard } from "@/components/advisor-card";
import { CollectionCard } from "@/components/collection-card";
import { ProfileCard } from "@/components/profile-card";
import { StatCard } from "@/components/stat-card";
import { getDashboardData } from "@/lib/repository";
import { formatCurrency } from "@/lib/utils";

export default async function DashboardPage() {
  const { collection, analytics, profile, drinkNow, buyNext } = await getDashboardData();

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Whisky Collection Intelligence</p>
        <h1>Your cellar, your palate, your own advisor.</h1>
        <p>
          Capture bottles, track official and independent releases, compare what you paid to what the
          market says now, and build a profile that actually reflects how you drink whisky.
        </p>
        <div className="hero-actions">
          <Link className="button" href="/add">
            Add a bottle
          </Link>
          <Link className="button-subtle" href="/compare">
            Compare whiskies
          </Link>
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Collection snapshot</h2>
            <p>Quick signal on your shelf, wishlist, and current market range.</p>
          </div>
        </div>
        <div className="stats-grid">
          <StatCard label="Owned" value={String(analytics.totals.owned)} hint="Bottles currently on your shelf." />
          <StatCard label="Wishlist" value={String(analytics.totals.wishlist)} hint="Future targets to hunt down." />
          <StatCard label="Paid total" value={formatCurrency(analytics.marketValue.paidTotalZar)} hint="Normalized to ZAR." />
          <StatCard
            label="Market range"
            value={`${formatCurrency(analytics.marketValue.marketLowZar)} - ${formatCurrency(analytics.marketValue.marketHighZar)}`}
            hint="Retail range across owned bottles."
          />
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Bottle profile</h2>
            <p>The schema signals that help the app classify your shelf.</p>
          </div>
        </div>
        <div className="stats-grid">
          <StatCard
            label="Brand tagged"
            value={String(analytics.bottleProfile.brandTagged)}
            hint="Owned bottles with an explicit label brand."
          />
          <StatCard label="NAS" value={String(analytics.bottleProfile.nas)} hint="No age statement bottles." />
          <StatCard
            label="Limited"
            value={String(analytics.bottleProfile.limited)}
            hint="Bottles flagged as limited releases."
          />
          <StatCard
            label="Avg bottle size"
            value={
              analytics.bottleProfile.averageVolumeMl ? `${analytics.bottleProfile.averageVolumeMl} ml` : "Not set"
            }
            hint={`${analytics.bottleProfile.withVolume} owned bottles have volume recorded.`}
          />
        </div>
      </section>

      <section className="grid columns-2">
        <div className="panel stack">
          <div className="section-title">
            <div>
              <h2>Drink now</h2>
              <p>Suggestions shaped by your current palate profile.</p>
            </div>
          </div>
          <div className="card-list">
            {drinkNow.map((suggestion) => (
              <AdvisorCard key={suggestion.itemId} suggestion={suggestion} />
            ))}
          </div>
        </div>
        <div className="panel stack">
          <div className="section-title">
            <div>
              <h2>Buy next</h2>
              <p>Wishlist guidance based on your ratings, tags, and regions.</p>
            </div>
          </div>
          <div className="card-list">
            {buyNext.map((suggestion) => (
              <AdvisorCard key={suggestion.itemId} suggestion={suggestion} />
            ))}
          </div>
        </div>
      </section>

      <section className="grid columns-2">
        <div className="panel stack">
          <div className="section-title">
            <div>
              <h2>Palate profile</h2>
              <p>The signals your own notes are already producing.</p>
            </div>
          </div>
          <div className="grid columns-2">
            {profile.cards.map((card) => (
              <ProfileCard card={card} key={card.title} />
            ))}
          </div>
        </div>
        <div className="panel stack">
          <div className="section-title">
            <div>
              <h2>Recently tracked bottles</h2>
              <p>Your most recent collection entries and cached pricing context.</p>
            </div>
            <Link className="button-subtle" href="/collection">
              See all
            </Link>
          </div>
          <div className="card-list">
            {collection.slice(0, 3).map((entry) => (
              <CollectionCard entry={entry} key={entry.item.id} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
