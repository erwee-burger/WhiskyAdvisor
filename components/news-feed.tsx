"use client";

import { useEffect, useRef, useState } from "react";

import type {
  NewsBudgetPreferences,
  NewsFeedItem,
  NewsSnapshotResponse,
  NewsSummaryCard
} from "@/lib/types";
import { computeBudgetFit } from "@/lib/news-budget";
import { getNewsItemVisitKey, reconcileSeenNewsItems } from "@/lib/news-visit";
import { NewsSummaryCards } from "./news-summary-cards";
import { NewsItem } from "./news-item";
import { NewsPreferencesPanel } from "./news-preferences-panel";

interface NewsFeedProps {
  initialSpecials: NewsFeedItem[];
  initialNewArrivals: NewsFeedItem[];
  initialSummaryCards: NewsSummaryCard[];
  initialFetchedAt: string | null;
  initialStale: boolean;
  initialPreferences: NewsBudgetPreferences;
  initialSeenItemKeys: string[] | null;
  isOwner: boolean;
}

const RETAILER_LABELS: Record<string, string> = {
  whiskybrother: "Whisky Brother",
  bottegawhiskey: "Bottega Whiskey",
  mothercityliquor: "Mother City Liquor",
  normangoodfellows: "Norman Goodfellows"
};

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "just now";
  if (diffHours === 1) return "1 hour ago";
  return `${diffHours} hours ago`;
}

function sameStringList(left: string[] | null, right: string[]): boolean {
  if (!left || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

async function persistSeenKeys(seenKeys: string[]) {
  const res = await fetch("/api/news/seen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seenKeys })
  });

  if (!res.ok) {
    throw new Error(`Failed to persist seen keys: ${res.status}`);
  }
}

function sortFreshFirst(items: NewsFeedItem[], unseenKeySet: Set<string>): NewsFeedItem[] {
  return items
    .map((item, index) => ({
      item,
      index,
      isFresh: unseenKeySet.has(getNewsItemVisitKey(item))
    }))
    .sort((left, right) => {
      if (left.isFresh === right.isFresh) return left.index - right.index;
      return left.isFresh ? -1 : 1;
    })
    .map(({ item }) => item);
}

export function NewsFeed({
  initialSpecials,
  initialNewArrivals,
  initialSummaryCards,
  initialFetchedAt,
  initialStale,
  initialPreferences,
  initialSeenItemKeys,
  isOwner
}: NewsFeedProps) {
  const initialVisitStateRef = useRef(
    isOwner
      ? reconcileSeenNewsItems([...initialSpecials, ...initialNewArrivals], initialSeenItemKeys)
      : { hadBaseline: false, seenKeys: [], unseenKeys: [] }
  );
  const hasSyncedInitialSeenRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [specials, setSpecials] = useState(initialSpecials);
  const [newArrivals, setNewArrivals] = useState(initialNewArrivals);
  const [summaryCards, setSummaryCards] = useState(initialSummaryCards);
  const [fetchedAt, setFetchedAt] = useState(initialFetchedAt);
  const [stale, setStale] = useState(initialStale);
  const [prefs, setPrefs] = useState(initialPreferences);
  const [activeRetailerFilter, setActiveRetailerFilter] = useState("all");
  const [hasVisitBaseline, setHasVisitBaseline] = useState(initialVisitStateRef.current.hadBaseline);
  const [knownSeenItemKeys, setKnownSeenItemKeys] = useState(initialVisitStateRef.current.seenKeys);
  const [unseenItemKeys, setUnseenItemKeys] = useState(initialVisitStateRef.current.unseenKeys);

  useEffect(() => {
    if (!isOwner) return;
    if (hasSyncedInitialSeenRef.current) return;
    hasSyncedInitialSeenRef.current = true;
    if (sameStringList(initialSeenItemKeys, initialVisitStateRef.current.seenKeys)) return;

    void persistSeenKeys(initialVisitStateRef.current.seenKeys).catch((error) => {
      console.error("Failed to persist initial seen state:", error);
    });
  }, [initialSeenItemKeys, isOwner]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/news/refresh", { method: "POST" });
      if (!res.ok) return;

      const newsRes = await fetch("/api/news");
      if (!newsRes.ok) return;

      const data: NewsSnapshotResponse = await newsRes.json();
      const visitState = isOwner
        ? reconcileSeenNewsItems([...data.specials, ...data.newArrivals], knownSeenItemKeys)
        : { hadBaseline: false, seenKeys: knownSeenItemKeys, unseenKeys: [] as string[] };

      setSpecials(data.specials);
      setNewArrivals(data.newArrivals);
      setSummaryCards(data.summaryCards);
      setFetchedAt(data.fetchedAt);
      setStale(data.stale);
      setPrefs(data.preferences);
      setHasVisitBaseline(visitState.hadBaseline);
      setKnownSeenItemKeys(visitState.seenKeys);
      setUnseenItemKeys(visitState.unseenKeys);

      if (isOwner && !sameStringList(knownSeenItemKeys, visitState.seenKeys)) {
        void persistSeenKeys(visitState.seenKeys).catch((error) => {
          console.error("Failed to persist seen state after refresh:", error);
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePreferencesSave = async (newPrefs: NewsBudgetPreferences) => {
    try {
      const res = await fetch("/api/news/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPrefs)
      });
      if (res.ok) {
        setPrefs(newPrefs);
        setSpecials((prev) => prev.map((item) => ({ ...item, budgetFit: computeBudgetFit(item.price, newPrefs) })));
        setNewArrivals((prev) => prev.map((item) => ({ ...item, budgetFit: computeBudgetFit(item.price, newPrefs) })));
        setShowPrefs(false);
      }
    } catch (error) {
      console.error("Failed to save preferences:", error);
    }
  };

  const showVisitState = isOwner && hasVisitBaseline;
  const unseenKeySet = showVisitState ? new Set(unseenItemKeys) : new Set<string>();
  const newToYouCount = unseenItemKeys.length;

  const filteredSpecials = sortFreshFirst(
    activeRetailerFilter === "all"
      ? specials
      : specials.filter((item) => item.source === activeRetailerFilter),
    unseenKeySet
  );
  const filteredArrivals = sortFreshFirst(
    activeRetailerFilter === "all"
      ? newArrivals
      : newArrivals.filter((item) => item.source === activeRetailerFilter),
    unseenKeySet
  );

  const knownRetailers = ["whiskybrother", "bottegawhiskey", "mothercityliquor", "normangoodfellows"];
  const retailers = ["all", ...knownRetailers];

  return (
    <>
      <div className="news-hero-meta">
        <div className="news-hero-status">
          <span className="news-timestamp">
            Last updated <strong>{fetchedAt ? formatTime(fetchedAt) : "never"}</strong>
            {stale && <span className="news-stale-indicator"> - Data is stale</span>}
          </span>
          {showVisitState && (
            <span className={`news-visit-summary ${newToYouCount > 0 ? "has-new" : "all-seen"}`}>
              {newToYouCount > 0
                ? `${newToYouCount} new since your last visit`
                : "No new items since your last visit"}
            </span>
          )}
        </div>

        {isOwner && (
          <div className="news-controls">
            <button
              className="button-subtle"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
            <button
              className="button-subtle"
              onClick={() => setShowPrefs(!showPrefs)}
            >
              Budget settings
            </button>
          </div>
        )}
      </div>

      {isOwner && showPrefs && (
        <NewsPreferencesPanel
          currentPreferences={prefs}
          onSave={handlePreferencesSave}
        />
      )}

      {summaryCards.length > 0 && (
        <section className="news-section">
          <div className="section-header">
            <h2>Today's picks</h2>
            <p>GPT's top three - curated for your palate and budget</p>
          </div>
          <NewsSummaryCards cards={summaryCards} />
        </section>
      )}

      {specials.length > 0 && (
        <section className="news-section">
          <div className="section-header">
            <h2>Specials</h2>
            <p>Price reductions spotted today. New-to-you items are pinned first.</p>
          </div>
          <div className="news-filters">
            <span className="news-filter-label">Retailer</span>
            {retailers.map((retailer) => (
              <button
                key={retailer}
                className={`news-pill ${activeRetailerFilter === retailer ? "active" : ""}`}
                onClick={() => setActiveRetailerFilter(retailer)}
              >
                {retailer === "all" ? "All" : RETAILER_LABELS[retailer] || retailer}
              </button>
            ))}
          </div>
          {filteredSpecials.length > 0 ? (
            <div className="news-items-grid">
              {filteredSpecials.map((item) => (
                <NewsItem
                  key={item.id}
                  item={item}
                  kind="special"
                  showBudget={isOwner}
                  visitState={showVisitState
                    ? unseenKeySet.has(getNewsItemVisitKey(item))
                      ? "new_to_you"
                      : "seen"
                    : undefined}
                />
              ))}
            </div>
          ) : (
            <div className="news-empty">No specials from that retailer right now.</div>
          )}
        </section>
      )}

      {newArrivals.length > 0 && (
        <section className="news-section">
          <div className="section-header">
            <h2>New arrivals</h2>
            <p>Fresh stock spotted for the first time this week. New-to-you items are pinned first.</p>
          </div>
          <div className="news-filters">
            <span className="news-filter-label">Retailer</span>
            {retailers.map((retailer) => (
              <button
                key={retailer}
                className={`news-pill ${activeRetailerFilter === retailer ? "active" : ""}`}
                onClick={() => setActiveRetailerFilter(retailer)}
              >
                {retailer === "all" ? "All" : RETAILER_LABELS[retailer] || retailer}
              </button>
            ))}
          </div>
          {filteredArrivals.length > 0 ? (
            <div className="news-items-grid">
              {filteredArrivals.map((item) => (
                <NewsItem
                  key={item.id}
                  item={item}
                  kind="new_release"
                  showBudget={isOwner}
                  visitState={showVisitState
                    ? unseenKeySet.has(getNewsItemVisitKey(item))
                      ? "new_to_you"
                      : "seen"
                    : undefined}
                />
              ))}
            </div>
          ) : (
            <div className="news-empty">No new arrivals from that retailer right now.</div>
          )}
        </section>
      )}
    </>
  );
}
