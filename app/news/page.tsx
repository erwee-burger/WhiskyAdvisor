// app/news/page.tsx
import { NewsFeed } from "@/components/news-feed";
import { getLatestSuccessfulSnapshot } from "@/lib/news-store";
import { getNewsPreferences } from "@/lib/news-preferences-store";
import { getNewsSeenKeys } from "@/lib/news-visit-store";
import { getSessionMode } from "@/lib/auth";
import { getPalateProfile } from "@/lib/repository";
import type { NewsFeedItem, NewsSummaryCard, PalateProfile } from "@/lib/types";

export default async function NewsPage() {
  const [preferences, sessionMode] = await Promise.all([
    getNewsPreferences(),
    getSessionMode()
  ]);
  const [snapshot, initialSeenItemKeys, initialProfile] = await Promise.all([
    getLatestSuccessfulSnapshot(preferences).catch(() => null),
    sessionMode === "owner"
      ? getNewsSeenKeys().catch(() => null)
      : Promise.resolve(null),
    sessionMode === "owner"
      ? getPalateProfile().catch(() => null)
      : Promise.resolve<PalateProfile | null>(null)
  ]);

  const specials:     NewsFeedItem[]    = snapshot?.specials     ?? [];
  const newArrivals:  NewsFeedItem[]    = snapshot?.newArrivals  ?? [];
  const summaryCards: NewsSummaryCard[] = snapshot?.summaryCards ?? [];
  const fetchedAt:    string | null     = snapshot?.fetchedAt    ?? null;
  const stale:        boolean           = fetchedAt ? (Date.now() - new Date(fetchedAt).getTime() > 12 * 60 * 60 * 1000) : true;

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Retailer Intelligence</p>
        <h1>What&apos;s on the shelves right now.</h1>
        <p>GPT-powered scan of SA whisky retailers — specials, new arrivals, and what&apos;s worth your attention today.</p>
      </section>

      <NewsFeed
        initialSpecials={specials}
        initialNewArrivals={newArrivals}
        initialSummaryCards={summaryCards}
        initialFetchedAt={fetchedAt}
        initialStale={stale}
        initialPreferences={preferences}
        initialSeenItemKeys={initialSeenItemKeys}
        initialProfile={initialProfile}
        isOwner={sessionMode === "owner"}
      />
    </div>
  );
}
