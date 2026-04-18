"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { CollectionCard } from "@/components/collection-card";
import { CollectionListView } from "@/components/collection-list-view";
import { MultiSelectCombobox } from "@/components/multi-select-combobox";
import { applyFilters, buildSearchHaystack, DEFAULT_FILTERS, filtersFromSearchParams } from "@/lib/collection-filters";
import type { CollectionFilters } from "@/lib/collection-filters";
import type { CollectionViewItem } from "@/lib/types";

type CollectionViewMode = "grid" | "list";

function uniq(arr: (string | undefined | null)[]): string[] {
  return [...new Set(arr.filter((v): v is string => typeof v === "string" && v.length > 0))].sort();
}

export function CollectionBrowser({ collection }: { collection: CollectionViewItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [status, setStatus] = useState("owned");
  const [filters, setFilters] = useState<CollectionFilters>(() =>
    filtersFromSearchParams(searchParams)
  );
  const [viewMode, setViewMode] = useState<CollectionViewMode>(() =>
    searchParams.get("view") === "list" ? "list" : "grid"
  );
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    setViewMode(searchParams.get("view") === "list" ? "list" : "grid");
  }, [searchParams]);

  function updateViewMode(nextView: CollectionViewMode) {
    setViewMode(nextView);

    const nextParams = new URLSearchParams(searchParams.toString());
    if (nextView === "grid") {
      nextParams.delete("view");
    } else {
      nextParams.set("view", nextView);
    }

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }

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
        <div className="field shelf-view-toggle-field">
          <label>View</label>
          <div aria-label="Choose collection layout" className="collection-view-toggle" role="tablist">
            <button
              aria-selected={viewMode === "grid"}
              className={`collection-view-toggle-btn${viewMode === "grid" ? " collection-view-toggle-btn-active" : ""}`}
              onClick={() => updateViewMode("grid")}
              role="tab"
              type="button"
            >
              Grid
            </button>
            <button
              aria-selected={viewMode === "list"}
              className={`collection-view-toggle-btn${viewMode === "list" ? " collection-view-toggle-btn-active" : ""}`}
              onClick={() => updateViewMode("list")}
              role="tab"
              type="button"
            >
              List
            </button>
          </div>
        </div>
        <button
          className={`filter-toggle-btn${activeFilterCount > 0 ? " filter-toggle-btn-active" : ""}`}
          onClick={() => setFilterOpen((prev) => !prev)}
          type="button"
        >
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>
      </div>

      {filterOpen && (
        <div className="filter-panel">
          <div className="filter-grid">
            <MultiSelectCombobox
              label="Tags"
              onChange={(v) => setFilters((f) => ({ ...f, tags: v }))}
              options={allOptions.tags}
              selected={filters.tags}
            />
            <MultiSelectCombobox
              label="Brand"
              onChange={(v) => setFilters((f) => ({ ...f, brands: v }))}
              options={allOptions.brands}
              selected={filters.brands}
            />
            <MultiSelectCombobox
              label="Distillery"
              onChange={(v) => setFilters((f) => ({ ...f, distilleries: v }))}
              options={allOptions.distilleries}
              selected={filters.distilleries}
            />
            <MultiSelectCombobox
              label="Bottler"
              onChange={(v) => setFilters((f) => ({ ...f, bottlers: v }))}
              options={allOptions.bottlers}
              selected={filters.bottlers}
            />
            <MultiSelectCombobox
              label="Country"
              onChange={(v) => setFilters((f) => ({ ...f, countries: v }))}
              options={allOptions.countries}
              selected={filters.countries}
            />
            <MultiSelectCombobox
              label="Purchase Source"
              onChange={(v) => setFilters((f) => ({ ...f, purchaseSources: v }))}
              options={allOptions.purchaseSources}
              selected={filters.purchaseSources}
            />

            <div className="filter-field">
              <label className="filter-field-label">Bottle State</label>
              <div className="filter-toggles">
                {(["sealed", "open", "finished"] as const).map((state) => (
                  <button
                    className={`filter-toggle${filters.fillStates.includes(state) ? " active" : ""}`}
                    key={state}
                    onClick={() =>
                      setFilters((f) => {
                        const next = f.fillStates.includes(state)
                          ? f.fillStates.filter((s) => s !== state)
                          : [...f.fillStates, state];
                        return { ...f, fillStates: next };
                      })
                    }
                    type="button"
                  >
                    {state.charAt(0).toUpperCase() + state.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-field">
              <label className="filter-field-label">ABV</label>
              <div className="filter-toggles">
                {(
                  [
                    { value: "under-46", label: "< 46%" },
                    { value: "46-55", label: "46–55%" },
                    { value: "55-plus", label: "55%+" }
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    className={`filter-toggle${filters.abvBuckets.includes(value) ? " active" : ""}`}
                    key={value}
                    onClick={() =>
                      setFilters((f) => {
                        const next = f.abvBuckets.includes(value)
                          ? f.abvBuckets.filter((b) => b !== value)
                          : [...f.abvBuckets, value];
                        return { ...f, abvBuckets: next };
                      })
                    }
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-field">
              <label className="filter-field-label">Age</label>
              <div className="filter-toggles">
                {(
                  [
                    { value: "nas", label: "NAS" },
                    { value: "under-12", label: "< 12yo" },
                    { value: "12-18", label: "12–18yo" },
                    { value: "18-25", label: "18–25yo" },
                    { value: "25-plus", label: "25yo+" }
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    className={`filter-toggle${filters.ageBuckets.includes(value) ? " active" : ""}`}
                    key={value}
                    onClick={() =>
                      setFilters((f) => {
                        const next = f.ageBuckets.includes(value)
                          ? f.ageBuckets.filter((b) => b !== value)
                          : [...f.ageBuckets, value];
                        return { ...f, ageBuckets: next };
                      })
                    }
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-field">
              <label className="filter-field-label">Rating</label>
              <div className="filter-toggles">
                {([1, 2, 3] as const).map((star) => (
                  <button
                    className={`filter-toggle${filters.ratings.includes(star) ? " active" : ""}`}
                    key={star}
                    onClick={() =>
                      setFilters((f) => {
                        const next = f.ratings.includes(star)
                          ? f.ratings.filter((r) => r !== star)
                          : [...f.ratings, star];
                        return { ...f, ratings: next };
                      })
                    }
                    type="button"
                  >
                    {"★".repeat(star)}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-field">
              <label className="filter-field-label">Favourite</label>
              <div className="filter-toggles">
                <button
                  className={`filter-toggle${filters.favoritesOnly ? " active" : ""}`}
                  onClick={() => setFilters((f) => ({ ...f, favoritesOnly: !f.favoritesOnly }))}
                  type="button"
                >
                  ♥ Favourites only
                </button>
              </div>
            </div>

            <div className="filter-field">
              <label className="filter-field-label">Purchase Price (ZAR)</label>
              <div className="filter-price">
                <input
                  min={0}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      priceMin: e.target.value ? Number(e.target.value) : undefined
                    }))
                  }
                  placeholder="Min"
                  type="number"
                  value={filters.priceMin ?? ""}
                />
                <span className="filter-price-sep">–</span>
                <input
                  min={0}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      priceMax: e.target.value ? Number(e.target.value) : undefined
                    }))
                  }
                  placeholder="Max"
                  type="number"
                  value={filters.priceMax ?? ""}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeChips.length > 0 && (
        <div className="filter-chips">
          {activeChips.map((chip) => (
            <button className="filter-chip" key={chip.key} onClick={chip.onRemove} type="button">
              {chip.label} ×
            </button>
          ))}
          <button
            className="filter-chip filter-chip-clear"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            type="button"
          >
            Clear all
          </button>
        </div>
      )}

      <div className="shelf-caption">
        <p>{visible.length} bottles in view right now.</p>
        <div className="pill-row">
          <span className="pill">
            {viewMode === "grid" ? "Hover a bottle for quick details" : "Scan more bottle details at a glance"}
          </span>
          <span className="pill">Search matches flavor tags too</span>
        </div>
      </div>

      {visible.length > 0 ? (
        viewMode === "grid" ? (
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
          <CollectionListView entries={visible} />
        )
      ) : (
        <div className="empty-state">
          No whiskies matched that search. Try a tag like `smoke`, `sherry`, `Campbeltown`, or
          `independent`.
        </div>
      )}
    </section>
  );
}
