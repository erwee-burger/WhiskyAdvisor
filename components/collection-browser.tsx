"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { CollectionCard } from "@/components/collection-card";
import { applyFilters, DEFAULT_FILTERS, filtersFromSearchParams } from "@/lib/collection-filters";
import type { CollectionFilters } from "@/lib/collection-filters";
import type { CollectionViewItem } from "@/lib/types";

function buildSearchHaystack(entry: CollectionViewItem) {
  return [
    entry.expression.name,
    entry.expression.brand,
    entry.expression.distilleryName,
    entry.expression.bottlerName,
    entry.expression.country,
    entry.expression.description,
    entry.expression.tags.join(" "),
    entry.item.status,
    entry.item.fillState,
    entry.item.purchaseSource,
    entry.item.personalNotes
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function uniq(arr: (string | undefined | null)[]): string[] {
  return [...new Set(arr.filter((v): v is string => typeof v === "string" && v.length > 0))].sort();
}

export function CollectionBrowser({ collection }: { collection: CollectionViewItem[] }) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [filters, setFilters] = useState<CollectionFilters>(() =>
    filtersFromSearchParams(searchParams)
  );
  const [filterOpen, setFilterOpen] = useState(false);

  const allOptions = useMemo(
    () => ({
      tags: uniq(collection.flatMap((e) => e.expression.tags)),
      brands: uniq(collection.map((e) => e.expression.brand)),
      distilleries: uniq(collection.map((e) => e.expression.distilleryName)),
      bottlers: uniq(collection.map((e) => e.expression.bottlerName)),
      countries: uniq(collection.map((e) => e.expression.country)),
      purchaseSources: uniq(collection.map((e) => e.item.purchaseSource))
    }),
    [collection]
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.tags.length > 0) count++;
    if (filters.brands.length > 0) count++;
    if (filters.distilleries.length > 0) count++;
    if (filters.bottlers.length > 0) count++;
    if (filters.countries.length > 0) count++;
    if (filters.purchaseSources.length > 0) count++;
    if (filters.fillStates.length > 0) count++;
    if (filters.abvBuckets.length > 0) count++;
    if (filters.ageBuckets.length > 0) count++;
    if (filters.ratings.length > 0) count++;
    if (filters.favoritesOnly) count++;
    if (filters.priceMin !== undefined || filters.priceMax !== undefined) count++;
    return count;
  }, [filters]);

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

    for (const v of filters.distilleries) {
      chips.push({ key: `distillery:${v}`, label: v, onRemove: () => setFilters((f) => ({ ...f, distilleries: f.distilleries.filter((x) => x !== v) })) });
    }
    for (const v of filters.bottlers) {
      chips.push({ key: `bottler:${v}`, label: v, onRemove: () => setFilters((f) => ({ ...f, bottlers: f.bottlers.filter((x) => x !== v) })) });
    }
    for (const v of filters.brands) {
      chips.push({ key: `brand:${v}`, label: v, onRemove: () => setFilters((f) => ({ ...f, brands: f.brands.filter((x) => x !== v) })) });
    }
    for (const v of filters.countries) {
      chips.push({ key: `country:${v}`, label: v, onRemove: () => setFilters((f) => ({ ...f, countries: f.countries.filter((x) => x !== v) })) });
    }
    for (const v of filters.purchaseSources) {
      chips.push({ key: `source:${v}`, label: v, onRemove: () => setFilters((f) => ({ ...f, purchaseSources: f.purchaseSources.filter((x) => x !== v) })) });
    }
    for (const v of filters.tags) {
      chips.push({ key: `tag:${v}`, label: v, onRemove: () => setFilters((f) => ({ ...f, tags: f.tags.filter((x) => x !== v) })) });
    }
    for (const v of filters.fillStates) {
      chips.push({ key: `fill:${v}`, label: v, onRemove: () => setFilters((f) => ({ ...f, fillStates: f.fillStates.filter((x) => x !== v) })) });
    }
    for (const v of filters.abvBuckets) {
      const label = v === "under-46" ? "< 46%" : v === "46-55" ? "46–55%" : v === "55-plus" ? "55%+" : v;
      chips.push({ key: `abv:${v}`, label, onRemove: () => setFilters((f) => ({ ...f, abvBuckets: f.abvBuckets.filter((x) => x !== v) })) });
    }
    for (const v of filters.ageBuckets) {
      const labels: Record<string, string> = { nas: "NAS", "under-12": "< 12yo", "12-18": "12–18yo", "18-25": "18–25yo", "25-plus": "25yo+" };
      chips.push({ key: `age:${v}`, label: labels[v] ?? v, onRemove: () => setFilters((f) => ({ ...f, ageBuckets: f.ageBuckets.filter((x) => x !== v) })) });
    }
    for (const v of filters.ratings) {
      chips.push({ key: `rating:${v}`, label: "★".repeat(v), onRemove: () => setFilters((f) => ({ ...f, ratings: f.ratings.filter((x) => x !== v) })) });
    }
    if (filters.favoritesOnly) {
      chips.push({ key: "favorites", label: "Favourites", onRemove: () => setFilters((f) => ({ ...f, favoritesOnly: false })) });
    }
    if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
      const label = filters.priceMin !== undefined && filters.priceMax !== undefined
        ? `ZAR ${filters.priceMin}–${filters.priceMax}`
        : filters.priceMin !== undefined
          ? `ZAR ≥ ${filters.priceMin}`
          : `ZAR ≤ ${filters.priceMax}`;
      chips.push({ key: "price", label, onRemove: () => setFilters((f) => ({ ...f, priceMin: undefined, priceMax: undefined })) });
    }

    return chips;
  }, [filters]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const statusFiltered = collection.filter((entry) => {
      const statusMatch = status === "all" ? true : entry.item.status === status;
      const textMatch = normalized ? buildSearchHaystack(entry).includes(normalized) : true;
      return statusMatch && textMatch;
    });
    return applyFilters(statusFiltered, filters);
  }, [collection, query, status, filters]);

  const rows = useMemo(() => {
    const chunkSize = 5;
    const output: CollectionViewItem[][] = [];
    for (let i = 0; i < visible.length; i += chunkSize) {
      output.push(visible.slice(i, i + chunkSize));
    }
    return output;
  }, [visible]);

  // Panel and chips UI will be added in Task 4.
  // For now render the existing toolbar + shelf to verify nothing broke.
  return (
    <section className="shelf-room">
      <div className="shelf-toolbar">
        <div className="field shelf-search">
          <label htmlFor="collection-search">Search by bottle, distillery, or tag</label>
          <input
            id="collection-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try smoke, Islay, Signatory, sherry, tropical-fruit..."
            value={query}
          />
        </div>
        <div className="field shelf-filter">
          <label htmlFor="collection-status">Status</label>
          <select
            id="collection-status"
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            <option value="all">All bottles</option>
            <option value="owned">Owned</option>
            <option value="wishlist">Wishlist</option>
          </select>
        </div>
        <button
          className={`filter-toggle-btn${activeFilterCount > 0 ? " filter-toggle-btn-active" : ""}`}
          onClick={() => setFilterOpen((prev) => !prev)}
          type="button"
        >
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>
      </div>

      <div className="shelf-caption">
        <p>{visible.length} bottles on the shelf right now.</p>
        <div className="pill-row">
          <span className="pill">Hover a bottle for quick details</span>
          <span className="pill">Search matches flavor tags too</span>
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="shelf-stack">
          {rows.map((row, index) => (
            <section className="shelf-row" key={`row-${index}`}>
              <div className="shelf-grid">
                {row.map((entry) => (
                  <CollectionCard entry={entry} interactive key={entry.item.id} />
                ))}
              </div>
              <div className="shelf-rail" />
            </section>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          No whiskies matched that search. Try a tag like `smoke`, `sherry`, `Campbeltown`, or
          `independent`.
        </div>
      )}
    </section>
  );
}
