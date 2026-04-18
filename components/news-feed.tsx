"use client";

import { useEffect, useRef, useState } from "react";

import { buildNewsBrowseResult, DEFAULT_NEWS_UI_FILTERS } from "@/lib/news-browse";
import { computeBudgetFit } from "@/lib/news-budget";
import { SOURCE_LABELS } from "@/lib/news-sources";
import { reconcileSeenNewsItems } from "@/lib/news-visit";
import type {
  NewsBudgetFilter,
  NewsBudgetPreferences,
  NewsFeedItem,
  NewsSnapshotResponse,
  NewsSortOption,
  NewsSummaryCard,
  NewsUiFilters,
  PalateProfile
} from "@/lib/types";
import { NewsItem } from "./news-item";
import { NewsPreferencesPanel } from "./news-preferences-panel";
import { NewsSummaryCards } from "./news-summary-cards";

interface NewsFeedProps {
  initialSpecials: NewsFeedItem[];
  initialNewArrivals: NewsFeedItem[];
  initialSummaryCards: NewsSummaryCard[];
  initialFetchedAt: string | null;
  initialStale: boolean;
  initialPreferences: NewsBudgetPreferences;
  initialSeenItemKeys: string[] | null;
  initialProfile: PalateProfile | null;
  isOwner: boolean;
}

const BUDGET_FILTER_LABELS: Record<NewsBudgetFilter, string> = {
  all: "All",
  in_budget: "In budget",
  stretch: "Stretch",
  over_budget_or_above: "Over / above budget"
};

const PALATE_FILTER_LABELS: Record<Exclude<NewsUiFilters["palateFit"], "all">, string> = {
  strong_fit: "Strong fit",
  good_fit: "Good fit",
  outside_usual_lane: "Outside usual lane"
};

const SORT_LABELS: Record<NewsSortOption, string> = {
  recommended: "Recommended",
  best_fit: "Best fit",
  price_low_to_high: "Price: low to high",
  price_high_to_low: "Price: high to low",
  biggest_discount: "Biggest discount"
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

function activeFilterSummary(filters: NewsUiFilters, showPalateFit: boolean, showVisitState: boolean): string[] {
  const labels: string[] = [];

  if (filters.retailer !== "all") {
    labels.push(SOURCE_LABELS[filters.retailer] ?? filters.retailer);
  }

  if (filters.budget !== "all") {
    labels.push(BUDGET_FILTER_LABELS[filters.budget]);
  }

  if (showPalateFit && filters.palateFit !== "all") {
    labels.push(PALATE_FILTER_LABELS[filters.palateFit]);
  }

  if (showVisitState && filters.freshness !== "all") {
    labels.push(filters.freshness === "new_to_you" ? "New to you" : "Seen before");
  }

  return labels;
}

function buildEmptyMessage(
  sectionLabel: string,
  filters: NewsUiFilters,
  showPalateFit: boolean,
  showVisitState: boolean
): string {
  const labels = activeFilterSummary(filters, showPalateFit, showVisitState);
  if (labels.length === 0) {
    return `No ${sectionLabel.toLowerCase()} right now.`;
  }

  return `No ${sectionLabel.toLowerCase()} match ${labels.join(", ")}.`;
}

export function NewsFeed({
  initialSpecials,
  initialNewArrivals,
  initialSummaryCards,
  initialFetchedAt,
  initialStale,
  initialPreferences,
  initialSeenItemKeys,
  initialProfile,
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
  const [filters, setFilters] = useState<NewsUiFilters>(DEFAULT_NEWS_UI_FILTERS);
  const [sortOption, setSortOption] = useState<NewsSortOption>("recommended");
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
  const newToYouCount = unseenItemKeys.length;
  const browse = buildNewsBrowseResult({
    specials,
    newArrivals,
    filters,
    sortOption,
    profile: initialProfile,
    showVisitState,
    unseenItemKeys
  });

  useEffect(() => {
    if (filters.retailer !== "all" && !browse.retailers.includes(filters.retailer)) {
      setFilters((current) => ({ ...current, retailer: "all" }));
    }
  }, [browse.retailers, filters.retailer]);

  useEffect(() => {
    if (!browse.showPalateFit && filters.palateFit !== "all") {
      setFilters((current) => ({ ...current, palateFit: "all" }));
    }
  }, [browse.showPalateFit, filters.palateFit]);

  useEffect(() => {
    if (!showVisitState && filters.freshness !== "all") {
      setFilters((current) => ({ ...current, freshness: "all" }));
    }
  }, [filters.freshness, showVisitState]);

  const retailerOptions = ["all", ...browse.retailers];
  const showSummaryCards = summaryCards.length > 0 && !browse.hasActiveFilters;

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

      <section className="news-browse-panel">
        <div className="news-toolbar">
          <div className="news-filter-group">
            <span className="news-filter-label">Retailer</span>
            <div className="news-filters">
              {retailerOptions.map((retailer) => (
                <button
                  key={retailer}
                  className={`news-pill ${filters.retailer === retailer ? "active" : ""}`}
                  onClick={() => setFilters((current) => ({ ...current, retailer }))}
                >
                  {retailer === "all" ? "All" : SOURCE_LABELS[retailer] || retailer}
                </button>
              ))}
            </div>
          </div>

          <div className="news-filter-group">
            <span className="news-filter-label">Budget</span>
            <div className="news-filters">
              {Object.entries(BUDGET_FILTER_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  className={`news-pill ${filters.budget === value ? "active" : ""}`}
                  onClick={() => setFilters((current) => ({ ...current, budget: value as NewsBudgetFilter }))}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {browse.showPalateFit && (
            <div className="news-filter-group">
              <span className="news-filter-label">Palate fit</span>
              <div className="news-filters">
                <button
                  className={`news-pill ${filters.palateFit === "all" ? "active" : ""}`}
                  onClick={() => setFilters((current) => ({ ...current, palateFit: "all" }))}
                >
                  All
                </button>
                {Object.entries(PALATE_FILTER_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    className={`news-pill ${filters.palateFit === value ? "active" : ""}`}
                    onClick={() => setFilters((current) => ({ ...current, palateFit: value as NewsUiFilters["palateFit"] }))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showVisitState && (
            <div className="news-filter-group">
              <span className="news-filter-label">Freshness</span>
              <div className="news-filters">
                {[
                  { value: "all", label: "All" },
                  { value: "new_to_you", label: "New to you" },
                  { value: "seen", label: "Seen" }
                ].map((option) => (
                  <button
                    key={option.value}
                    className={`news-pill ${filters.freshness === option.value ? "active" : ""}`}
                    onClick={() => setFilters((current) => ({
                      ...current,
                      freshness: option.value as NewsUiFilters["freshness"]
                    }))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="news-toolbar-footer">
            <div className="news-sort-control">
              <label className="news-filter-label" htmlFor="news-sort">Sort</label>
              <select
                id="news-sort"
                className="news-sort-select"
                value={sortOption}
                onChange={(event) => setSortOption(event.target.value as NewsSortOption)}
              >
                {Object.entries(SORT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {browse.hasActiveFilters ? (
              <button
                className="button-subtle"
                onClick={() => setFilters(DEFAULT_NEWS_UI_FILTERS)}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {showSummaryCards && (
        <section className="news-section">
          <div className="section-header">
            <div className="section-header-copy">
              <h2>Today's picks</h2>
              <p>GPT's top three - curated for your palate and budget.</p>
            </div>
          </div>
          <NewsSummaryCards cards={summaryCards} />
        </section>
      )}

      {specials.length > 0 && (
        <section className="news-section">
          <div className="section-header">
            <div className="section-header-copy">
              <h2>
                Specials <span className="section-count">{browse.specials.length}</span>
              </h2>
              <p>Price reductions spotted today, with savings and palate fit surfaced first.</p>
            </div>
          </div>
          {browse.specials.length > 0 ? (
            <div className="news-items-grid">
              {browse.specials.map((browseItem) => (
                <NewsItem
                  key={browseItem.item.id}
                  item={browseItem.item}
                  showBudget={isOwner}
                  affinity={browseItem.affinity}
                  reasonTags={browseItem.reasonTags}
                  signalLabel={browseItem.signalLabel}
                  saveAmount={browseItem.saveAmount}
                  visitState={browseItem.visitState}
                />
              ))}
            </div>
          ) : (
            <div className="news-empty">{buildEmptyMessage("Specials", filters, browse.showPalateFit, showVisitState)}</div>
          )}
        </section>
      )}

      {newArrivals.length > 0 && (
        <section className="news-section">
          <div className="section-header">
            <div className="section-header-copy">
              <h2>
                New arrivals <span className="section-count">{browse.newArrivals.length}</span>
              </h2>
              <p>Fresh stock, notable releases, and bottles that fit your lane.</p>
            </div>
          </div>
          {browse.newArrivals.length > 0 ? (
            <div className="news-items-grid">
              {browse.newArrivals.map((browseItem) => (
                <NewsItem
                  key={browseItem.item.id}
                  item={browseItem.item}
                  showBudget={isOwner}
                  affinity={browseItem.affinity}
                  reasonTags={browseItem.reasonTags}
                  signalLabel={browseItem.signalLabel}
                  saveAmount={browseItem.saveAmount}
                  visitState={browseItem.visitState}
                />
              ))}
            </div>
          ) : (
            <div className="news-empty">{buildEmptyMessage("New arrivals", filters, browse.showPalateFit, showVisitState)}</div>
          )}
        </section>
      )}
    </>
  );
}
