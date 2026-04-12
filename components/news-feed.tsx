// components/news-feed.tsx
"use client";

import { useState, useEffect } from "react";
import { NewsItem } from "@/components/news-item";
import { NewsSummaryCards } from "@/components/news-summary-cards";
import { NewsPreferencesPanel } from "@/components/news-preferences-panel";
import { SOURCE_LABELS } from "@/lib/news-sources";
import type { NewsFeedItem, NewsSummaryCard, NewsBudgetPreferences } from "@/lib/types";
import { computeBudgetFit } from "@/lib/news-budget";

interface Props {
  initialSpecials:    NewsFeedItem[];
  initialNewArrivals: NewsFeedItem[];
  initialSummaryCards: NewsSummaryCard[];
  initialFetchedAt:   string | null;
  initialStale:       boolean;
  initialPreferences: NewsBudgetPreferences;
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "less than an hour ago";
  if (hours === 1) return "1 hour ago";
  return `${hours} hours ago`;
}

function FilterChips({
  items,
  activeSources,
  onToggle
}: {
  items: NewsFeedItem[];
  activeSources: Set<string>;
  onToggle: (source: string) => void;
}) {
  const allSources = [...new Set(items.map(i => i.source))];
  if (allSources.length <= 1) return null;

  return (
    <div className="news-feed__filters">
      {allSources.map(source => (
        <button
          key={source}
          className={`news-feed__chip ${activeSources.has(source) ? "news-feed__chip--active" : ""}`}
          onClick={() => onToggle(source)}
        >
          {SOURCE_LABELS[source] ?? source}
        </button>
      ))}
    </div>
  );
}

function Section({
  title,
  items,
  emptyMessage
}: {
  title: string;
  items: NewsFeedItem[];
  emptyMessage: string;
}) {
  const allSources = [...new Set(items.map(i => i.source))];
  const [activeSources, setActiveSources] = useState<Set<string>>(
    () => new Set(allSources)
  );

  // Reset filter chips when items list changes (after a refresh)
  useEffect(() => {
    setActiveSources(new Set(items.map(i => i.source)));
  }, [items]);

  function toggleSource(source: string) {
    setActiveSources(prev => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  }

  const filtered = items.filter(i => activeSources.has(i.source));

  return (
    <section className="news-feed__section stack">
      <h2>{title}</h2>
      <FilterChips
        items={items}
        activeSources={activeSources}
        onToggle={toggleSource}
      />
      {filtered.length === 0 ? (
        <p className="news-feed__empty">{emptyMessage}</p>
      ) : (
        <div className="news-feed__grid">
          {filtered.map(item => (
            <NewsItem
              key={item.id}
              name={item.name}
              price={item.price}
              originalPrice={item.originalPrice}
              discountPct={item.discountPct}
              url={item.url}
              imageUrl={item.imageUrl}
              kind={item.kind}
              budgetFit={item.budgetFit}
              whyItMatters={item.whyItMatters}
              source={item.source}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function NewsFeed({
  initialSpecials,
  initialNewArrivals,
  initialSummaryCards,
  initialFetchedAt,
  initialStale,
  initialPreferences
}: Props) {
  const [specials, setSpecials]         = useState(initialSpecials);
  const [newArrivals, setNewArrivals]   = useState(initialNewArrivals);
  const [summaryCards, setSummaryCards] = useState(initialSummaryCards);
  const [fetchedAt, setFetchedAt]       = useState(initialFetchedAt);
  const [stale, setStale]               = useState(initialStale);
  const [preferences, setPreferences]   = useState(initialPreferences);
  const [refreshing, setRefreshing]     = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [error, setError]               = useState<string | null>(null);
  const [showPrefs, setShowPrefs]       = useState(false);

  async function loadNews(currentPrefs: NewsBudgetPreferences) {
    try {
      const res = await fetch("/api/news");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as {
        specials: NewsFeedItem[];
        newArrivals: NewsFeedItem[];
        summaryCards: NewsSummaryCard[];
        fetchedAt: string | null;
        stale: boolean;
        preferences: NewsBudgetPreferences;
      };
      // Re-apply budget fit with the current (possibly just-saved) preferences
      const applyPrefs = (items: NewsFeedItem[]) =>
        items.map(i => ({ ...i, budgetFit: computeBudgetFit(i.price, currentPrefs) }));

      setSpecials(applyPrefs(data.specials));
      setNewArrivals(applyPrefs(data.newArrivals));
      setSummaryCards(data.summaryCards);
      setFetchedAt(data.fetchedAt);
      setStale(data.stale);
    } catch (err) {
      setError("Couldn't load news right now. Try refreshing.");
      console.error("[news-feed] loadNews failed:", err);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshMessage("");
    setError(null);
    const timer = setTimeout(() => setRefreshMessage("Still fetching from retailers…"), 15000);
    try {
      await fetch("/api/news/refresh", { method: "POST" });
      await loadNews(preferences);
    } catch (err) {
      setError("Refresh failed. The previous snapshot is still showing.");
      console.error("[news-feed] refresh failed:", err);
    } finally {
      clearTimeout(timer);
      setRefreshing(false);
      setRefreshMessage("");
    }
  }

  function handlePreferencesSaved(prefs: NewsBudgetPreferences) {
    setPreferences(prefs);
    // Re-apply budget fit immediately from cached data, no network round-trip needed
    setSpecials(prev => prev.map(i => ({ ...i, budgetFit: computeBudgetFit(i.price, prefs) })));
    setNewArrivals(prev => prev.map(i => ({ ...i, budgetFit: computeBudgetFit(i.price, prefs) })));
  }

  return (
    <div className="news-feed stack">
      {/* Freshness bar */}
      <div className="news-feed__meta">
        {fetchedAt && (
          <p className="news-feed__freshness">
            Last updated {timeAgo(fetchedAt)}{stale ? " — data may be stale" : ""}
          </p>
        )}
        <div className="news-feed__actions">
          <button
            className="news-feed__refresh"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing…" : "Refresh ↻"}
          </button>
          <button
            className="news-feed__prefs-toggle"
            onClick={() => setShowPrefs(p => !p)}
            aria-expanded={showPrefs}
          >
            Budget preferences
          </button>
        </div>
        {refreshMessage && <p className="news-feed__refresh-msg">{refreshMessage}</p>}
      </div>

      {error && <p className="news-feed__error">{error}</p>}

      {showPrefs && (
        <NewsPreferencesPanel
          initialPreferences={preferences}
          onSaved={handlePreferencesSaved}
        />
      )}

      {/* GPT intelligence summary cards */}
      <NewsSummaryCards cards={summaryCards} />

      {/* Two content sections */}
      <Section
        title="What's on special"
        items={specials}
        emptyMessage="No specials found right now — refresh to check."
      />
      <Section
        title="New arrivals"
        items={newArrivals}
        emptyMessage="No new arrivals right now — refresh to check."
      />
    </div>
  );
}
