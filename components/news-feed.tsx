"use client";

import { useState } from "react";
import { NewsItem } from "@/components/news-item";
import type { ScoredNewsItem } from "@/lib/types";

const SOURCE_LABELS: Record<string, string> = {
  whiskybrother: "Whisky Brother",
  bottegawhiskey: "Bottega Whiskey",
  mothercityliquor: "Mother City Liquor",
  whiskyemporium: "Whisky Emporium",
  normangoodfellows: "Norman Goodfellows"
};

interface Props {
  title: string;
  items: ScoredNewsItem[];
  emptyMessage: string;
}

export function NewsFeed({ title, items, emptyMessage }: Props) {
  const allSources = [...new Set(items.map(i => i.source))];
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set(allSources));

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
    <div className="news-feed stack">
      <h2>{title}</h2>

      {allSources.length > 1 && (
        <div className="news-feed__filters">
          {allSources.map(source => (
            <button
              key={source}
              className={`news-feed__chip ${activeSources.has(source) ? "news-feed__chip--active" : ""}`}
              onClick={() => toggleSource(source)}
            >
              {SOURCE_LABELS[source] ?? source}
            </button>
          ))}
        </div>
      )}

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
              palateStars={item.palateStars}
              source={item.source}
            />
          ))}
        </div>
      )}
    </div>
  );
}
