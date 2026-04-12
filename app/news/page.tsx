// app/news/page.tsx
import { NewsFeed } from "@/components/news-feed";
import { getLatestSuccessfulSnapshot } from "@/lib/news-store";
import { getNewsPreferences } from "@/lib/news-preferences-store";
import type { NewsFeedItem, NewsSummaryCard } from "@/lib/types";

export default async function NewsPage() {
  const preferences = await getNewsPreferences();
  const snapshot = await getLatestSuccessfulSnapshot(preferences).catch(() => null);

  const specials:     NewsFeedItem[]    = snapshot?.specials     ?? [];
  const newArrivals:  NewsFeedItem[]    = snapshot?.newArrivals  ?? [];
  const summaryCards: NewsSummaryCard[] = snapshot?.summaryCards ?? [];
  const fetchedAt:    string | null     = snapshot?.fetchedAt    ?? null;
  const stale:        boolean           = fetchedAt ? (Date.now() - new Date(fetchedAt).getTime() > 12 * 60 * 60 * 1000) : true;

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">News</p>
        <h1>What&apos;s on the shelves right now.</h1>
      </section>

      <NewsFeed
        initialSpecials={specials}
        initialNewArrivals={newArrivals}
        initialSummaryCards={summaryCards}
        initialFetchedAt={fetchedAt}
        initialStale={stale}
        initialPreferences={preferences}
      />
    </div>
  );
}
