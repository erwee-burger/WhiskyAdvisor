"use client";

import { useState } from "react";
import type { NewsFeedItem, NewsSummaryCard, NewsBudgetPreferences } from "@/lib/types";
import { computeBudgetFit } from "@/lib/news-budget";
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
}

const RETAILER_LABELS: Record<string, string> = {
  whiskybrother: "Whisky Brother",
  bottegawhiskey: "Bottega Whiskey",
  mothercityliquor: "Mother City Liquor",
  whiskyemporium: "Whisky Emporium",
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

export function NewsFeed({
  initialSpecials,
  initialNewArrivals,
  initialSummaryCards,
  initialFetchedAt,
  initialStale,
  initialPreferences
}: NewsFeedProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [specials, setSpecials] = useState(initialSpecials);
  const [newArrivals, setNewArrivals] = useState(initialNewArrivals);
  const [summaryCards, setSummaryCards] = useState(initialSummaryCards);
  const [fetchedAt, setFetchedAt] = useState(initialFetchedAt);
  const [stale, setStale] = useState(initialStale);
  const [prefs, setPrefs] = useState(initialPreferences);
  const [activeRetailerFilter, setActiveRetailerFilter] = useState("all");

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/news/refresh", { method: "POST" });
      if (res.ok) {
        const newsRes = await fetch("/api/news");
        const data = await newsRes.json();
        setSpecials(data.specials);
        setNewArrivals(data.newArrivals);
        setSummaryCards(data.summaryCards);
        setFetchedAt(data.fetchedAt);
        setStale(data.stale);
        setPrefs(data.preferences);
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
        // Re-apply budget fit to items
        setSpecials(prev => prev.map(i => ({ ...i, budgetFit: computeBudgetFit(i.price, newPrefs) })));
        setNewArrivals(prev => prev.map(i => ({ ...i, budgetFit: computeBudgetFit(i.price, newPrefs) })));
        setShowPrefs(false);
      }
    } catch (e) {
      console.error("Failed to save preferences:", e);
    }
  };

  // Filter by retailer
  const filteredSpecials = activeRetailerFilter === "all"
    ? specials
    : specials.filter(item => item.source === activeRetailerFilter);
  const filteredArrivals = activeRetailerFilter === "all"
    ? newArrivals
    : newArrivals.filter(item => item.source === activeRetailerFilter);

  const retailers = [
    "all",
    ...Array.from(new Set([...specials, ...newArrivals].map(item => item.source)))
  ];

  return (
    <>
      {/* Hero meta and controls */}
      <div className="news-hero-meta">
        <span className="news-timestamp">
          Last updated <strong>{fetchedAt ? formatTime(fetchedAt) : "never"}</strong>
          {stale && <span className="news-stale-indicator"> · Data is stale</span>}
        </span>
        <div className="news-controls">
          <button
            className="button-subtle"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? "↻ Refreshing..." : "↻ Refresh"}
          </button>
          <button
            className="button-subtle"
            onClick={() => setShowPrefs(!showPrefs)}
          >
            ◈ Budget settings
          </button>
        </div>
      </div>

      {/* Preferences panel (collapsible) */}
      {showPrefs && (
        <NewsPreferencesPanel
          currentPreferences={prefs}
          onSave={handlePreferencesSave}
        />
      )}

      {/* GPT Intelligence Cards */}
      {summaryCards.length > 0 && (
        <section className="news-section">
          <div className="section-header">
            <h2>Today's picks</h2>
            <p>GPT's top three — curated for your palate and budget</p>
          </div>
          <NewsSummaryCards cards={summaryCards} />
        </section>
      )}

      {/* Specials */}
      {specials.length > 0 && (
        <section className="news-section">
          <div className="section-header">
            <h2>Specials</h2>
            <p>Price reductions spotted today</p>
          </div>
          <div className="news-filters">
            <span className="news-filter-label">Retailer</span>
            {retailers.map(retailer => (
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
              {filteredSpecials.map(item => (
                <NewsItem key={item.id} item={item} kind="special" />
              ))}
            </div>
          ) : (
            <div className="news-empty">No specials from that retailer right now.</div>
          )}
        </section>
      )}

      {/* New Arrivals */}
      {newArrivals.length > 0 && (
        <section className="news-section">
          <div className="section-header">
            <h2>New arrivals</h2>
            <p>Fresh stock spotted for the first time this week</p>
          </div>
          <div className="news-filters">
            <span className="news-filter-label">Retailer</span>
            {retailers.map(retailer => (
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
              {filteredArrivals.map(item => (
                <NewsItem key={item.id} item={item} kind="new_release" />
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
