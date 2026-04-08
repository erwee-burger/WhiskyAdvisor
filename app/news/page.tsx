"use client";

import { useEffect, useState } from "react";
import { NewsFeed } from "@/components/news-feed";
import type { ScoredNewsItem, NewsSuggestion } from "@/lib/types";
import { scoreToPalateStars } from "@/lib/news-store";

interface RawNewsRow {
  id: string;
  source: string;
  kind: string;
  name: string;
  price: number;
  original_price: number | null;
  discount_pct: number | null;
  url: string;
  image_url: string | null;
  in_stock: boolean;
  fetched_at: string;
}

interface NewsResponse {
  specials: RawNewsRow[];
  newReleases: RawNewsRow[];
  fetchedAt: string | null;
  stale: boolean;
}

function toScoredItem(raw: RawNewsRow): ScoredNewsItem {
  const score = 0; // palate scoring happens server-side in a future enhancement
  return {
    id: raw.id,
    source: raw.source,
    kind: raw.kind as "special" | "new_release",
    name: raw.name,
    price: raw.price,
    originalPrice: raw.original_price ?? undefined,
    discountPct: raw.discount_pct ?? undefined,
    url: raw.url,
    imageUrl: raw.image_url ?? undefined,
    inStock: raw.in_stock,
    fetchedAt: raw.fetched_at,
    palateScore: score,
    palateStars: scoreToPalateStars(score)
  };
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "less than an hour ago";
  if (hours === 1) return "1 hour ago";
  return `${hours} hours ago`;
}

export default function NewsPage() {
  const [specials, setSpecials] = useState<ScoredNewsItem[]>([]);
  const [newReleases, setNewReleases] = useState<ScoredNewsItem[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<NewsSuggestion[]>([]);

  async function loadSuggestions() {
    try {
      const res = await fetch("/api/news/suggestions");
      if (!res.ok) return;
      const data = await res.json() as { picks: NewsSuggestion[] };
      setSuggestions(data.picks ?? []);
    } catch {
      // suggestions are non-critical, fail silently
    }
  }

  async function loadNews() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/news");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: NewsResponse = await res.json();
      setSpecials(data.specials.map(toScoredItem));
      setNewReleases(data.newReleases.map(toScoredItem));
      setFetchedAt(data.fetchedAt);
      setStale(data.stale);
    } catch (err) {
      setError("Couldn't load news right now. Try refreshing.");
      console.error("[news page] loadNews failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshMessage("");
    const timer = setTimeout(() => setRefreshMessage("Still fetching…"), 10000);
    try {
      await fetch("/api/news/refresh", { method: "POST" });
      await Promise.all([loadNews(), loadSuggestions()]);
    } catch (err) {
      console.error("[news page] refresh failed:", err);
    } finally {
      clearTimeout(timer);
      setRefreshing(false);
      setRefreshMessage("");
    }
  }

  useEffect(() => {
    loadNews();
    loadSuggestions();
  }, []);

  if (loading) {
    return (
      <div className="page">
        <section className="hero">
          <p className="eyebrow">News</p>
          <h1>What&apos;s on the shelves right now.</h1>
        </section>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">News</p>
        <h1>What&apos;s on the shelves right now.</h1>
        <div className="news-page__meta">
          {fetchedAt && <p>Last updated {timeAgo(fetchedAt)}{stale ? " — data may be stale" : ""}</p>}
          <button
            className="news-page__refresh"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing…" : "Refresh ↻"}
          </button>
          {refreshMessage && <p>{refreshMessage}</p>}
        </div>
      </section>

      {error && <p className="news-page__error">{error}</p>}

      {suggestions.length > 0 && (
        <section className="news-page__suggestions">
          <h2>Picked for you</h2>
          <ul className="news-page__suggestions-list">
            {suggestions.map((s) => (
              <li key={s.url} className="news-page__suggestion-item">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="news-page__suggestion-name">
                  {s.name}
                </a>
                <span className="news-page__suggestion-price">
                  R{s.price}{s.discountPct ? ` — ${s.discountPct}% off` : ""}
                </span>
                <p className="news-page__suggestion-reason">{s.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <NewsFeed
        title="What's on special"
        items={specials}
        emptyMessage="No specials found right now — check back later."
      />

      <NewsFeed
        title="New arrivals"
        items={newReleases}
        emptyMessage="No new arrivals right now — check back later."
      />
    </div>
  );
}
