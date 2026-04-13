# Collection Filter Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible 12-filter panel to the Collection page, with searchable multi-select comboboxes, bucket toggles, active filter chips, and URL-based seeding for future stats→collection navigation.

**Architecture:** Pure client-side filtering via `useMemo` over the full collection prop. Filter types and logic extracted to `lib/collection-filters.ts` for testability. A reusable `MultiSelectCombobox` component handles all 6 text-based filters. Filter state is seeded from `useSearchParams` on mount (read-only; not written back on interaction).

**Tech Stack:** React 19, Next.js 15 App Router, TypeScript, Vitest, plain CSS with existing custom properties.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/collection-filters.ts` | Create | `CollectionFilters` type, `DEFAULT_FILTERS`, `applyFilters()`, bucket helpers, `filtersFromSearchParams()` |
| `tests/collection-filters.test.ts` | Create | Unit tests for all filter logic and URL seeding |
| `components/multi-select-combobox.tsx` | Create | Reusable searchable multi-select dropdown |
| `components/collection-browser.tsx` | Modify | Filter state, panel UI, chips, URL seeding, updated `useMemo` |
| `app/collection/page.tsx` | Modify | Wrap `CollectionBrowser` in `<Suspense>` |
| `app/globals.css` | Modify | Styles for filter panel, toggle buttons, chips, combobox |

---

## Task 1: Filter types and logic

**Files:**
- Create: `lib/collection-filters.ts`
- Create: `tests/collection-filters.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/collection-filters.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { applyFilters, DEFAULT_FILTERS, filtersFromSearchParams, hasActiveFilters } from "@/lib/collection-filters";
import type { CollectionViewItem } from "@/lib/types";

function makeEntry(overrides: {
  tags?: string[];
  brand?: string;
  distilleryName?: string;
  bottlerName?: string;
  country?: string;
  abv?: number;
  ageStatement?: number;
  purchaseSource?: string;
  fillState?: "sealed" | "open" | "finished";
  purchasePrice?: number;
  rating?: 1 | 2 | 3;
  isFavorite?: boolean;
}): CollectionViewItem {
  return {
    item: {
      id: "item-1",
      expressionId: "expr-1",
      status: "owned",
      fillState: overrides.fillState ?? "sealed",
      purchaseSource: overrides.purchaseSource,
      purchasePrice: overrides.purchasePrice,
      rating: overrides.rating,
      isFavorite: overrides.isFavorite,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    },
    expression: {
      id: "expr-1",
      name: "Test Whisky",
      tags: overrides.tags ?? [],
      brand: overrides.brand,
      distilleryName: overrides.distilleryName,
      bottlerName: overrides.bottlerName,
      country: overrides.country,
      abv: overrides.abv,
      ageStatement: overrides.ageStatement
    },
    images: []
  };
}

describe("hasActiveFilters", () => {
  it("returns false for DEFAULT_FILTERS", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
  });

  it("returns true when any array is non-empty", () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, distilleries: ["Ardbeg"] })).toBe(true);
  });

  it("returns true when favoritesOnly is true", () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, favoritesOnly: true })).toBe(true);
  });

  it("returns true when priceMin is set", () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, priceMin: 500 })).toBe(true);
  });
});

describe("applyFilters — combobox filters", () => {
  it("passes all entries when no filters active", () => {
    const entries = [makeEntry({ distilleryName: "Ardbeg" }), makeEntry({ distilleryName: "Laphroaig" })];
    expect(applyFilters(entries, DEFAULT_FILTERS)).toHaveLength(2);
  });

  it("filters by distillery (OR within type)", () => {
    const ardbeg = makeEntry({ distilleryName: "Ardbeg" });
    const laphroaig = makeEntry({ distilleryName: "Laphroaig" });
    const glenfarclas = makeEntry({ distilleryName: "Glenfarclas" });
    const result = applyFilters([ardbeg, laphroaig, glenfarclas], {
      ...DEFAULT_FILTERS,
      distilleries: ["Ardbeg", "Laphroaig"]
    });
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.expression.distilleryName)).toEqual(["Ardbeg", "Laphroaig"]);
  });

  it("filters by tag (OR within type)", () => {
    const peated = makeEntry({ tags: ["peated", "smoke"] });
    const sherry = makeEntry({ tags: ["sherry-cask"] });
    const result = applyFilters([peated, sherry], { ...DEFAULT_FILTERS, tags: ["peated"] });
    expect(result).toHaveLength(1);
    expect(result[0].expression.tags).toContain("peated");
  });

  it("ANDs across filter types", () => {
    const match = makeEntry({ distilleryName: "Ardbeg", country: "Scotland" });
    const wrongCountry = makeEntry({ distilleryName: "Ardbeg", country: "Japan" });
    const result = applyFilters([match, wrongCountry], {
      ...DEFAULT_FILTERS,
      distilleries: ["Ardbeg"],
      countries: ["Scotland"]
    });
    expect(result).toHaveLength(1);
  });

  it("excludes entry with no distilleryName when distillery filter active", () => {
    const noDistillery = makeEntry({});
    const result = applyFilters([noDistillery], { ...DEFAULT_FILTERS, distilleries: ["Ardbeg"] });
    expect(result).toHaveLength(0);
  });
});

describe("applyFilters — fill state", () => {
  it("filters by fill state", () => {
    const sealed = makeEntry({ fillState: "sealed" });
    const open = makeEntry({ fillState: "open" });
    const finished = makeEntry({ fillState: "finished" });
    const result = applyFilters([sealed, open, finished], { ...DEFAULT_FILTERS, fillStates: ["open", "finished"] });
    expect(result).toHaveLength(2);
  });
});

describe("applyFilters — ABV buckets", () => {
  it("under-46 matches ABV below 46", () => {
    const entry = makeEntry({ abv: 43 });
    expect(applyFilters([entry], { ...DEFAULT_FILTERS, abvBuckets: ["under-46"] })).toHaveLength(1);
  });

  it("46-55 matches ABV in range", () => {
    const entry = makeEntry({ abv: 46 });
    expect(applyFilters([entry], { ...DEFAULT_FILTERS, abvBuckets: ["46-55"] })).toHaveLength(1);
    const entry2 = makeEntry({ abv: 55 });
    expect(applyFilters([entry2], { ...DEFAULT_FILTERS, abvBuckets: ["46-55"] })).toHaveLength(1);
  });

  it("55-plus matches ABV above 55", () => {
    const entry = makeEntry({ abv: 57.1 });
    expect(applyFilters([entry], { ...DEFAULT_FILTERS, abvBuckets: ["55-plus"] })).toHaveLength(1);
  });

  it("excludes entry with no ABV when bucket filter active", () => {
    const entry = makeEntry({});
    expect(applyFilters([entry], { ...DEFAULT_FILTERS, abvBuckets: ["under-46"] })).toHaveLength(0);
  });
});

describe("applyFilters — age buckets", () => {
  it("nas matches entry with 'nas' tag", () => {
    const entry = makeEntry({ tags: ["nas"] });
    expect(applyFilters([entry], { ...DEFAULT_FILTERS, ageBuckets: ["nas"] })).toHaveLength(1);
  });

  it("nas matches entry with no ageStatement", () => {
    const entry = makeEntry({});
    expect(applyFilters([entry], { ...DEFAULT_FILTERS, ageBuckets: ["nas"] })).toHaveLength(1);
  });

  it("under-12 matches ageStatement < 12", () => {
    const entry = makeEntry({ ageStatement: 10 });
    expect(applyFilters([entry], { ...DEFAULT_FILTERS, ageBuckets: ["under-12"] })).toHaveLength(1);
  });

  it("12-18 matches ageStatement 12 through 18", () => {
    const entry = makeEntry({ ageStatement: 16 });
    expect(applyFilters([entry], { ...DEFAULT_FILTERS, ageBuckets: ["12-18"] })).toHaveLength(1);
  });

  it("18-25 matches ageStatement 19 through 25", () => {
    const entry = makeEntry({ ageStatement: 21 });
    expect(applyFilters([entry], { ...DEFAULT_FILTERS, ageBuckets: ["18-25"] })).toHaveLength(1);
  });

  it("25-plus matches ageStatement above 25", () => {
    const entry = makeEntry({ ageStatement: 30 });
    expect(applyFilters([entry], { ...DEFAULT_FILTERS, ageBuckets: ["25-plus"] })).toHaveLength(1);
  });
});

describe("applyFilters — price range", () => {
  it("filters by priceMin", () => {
    const cheap = makeEntry({ purchasePrice: 400 });
    const expensive = makeEntry({ purchasePrice: 1500 });
    const result = applyFilters([cheap, expensive], { ...DEFAULT_FILTERS, priceMin: 500 });
    expect(result).toHaveLength(1);
    expect(result[0].item.purchasePrice).toBe(1500);
  });

  it("filters by priceMax", () => {
    const cheap = makeEntry({ purchasePrice: 400 });
    const expensive = makeEntry({ purchasePrice: 1500 });
    const result = applyFilters([cheap, expensive], { ...DEFAULT_FILTERS, priceMax: 1000 });
    expect(result).toHaveLength(1);
    expect(result[0].item.purchasePrice).toBe(400);
  });

  it("excludes entry with no purchasePrice when price filter active", () => {
    const entry = makeEntry({});
    expect(applyFilters([entry], { ...DEFAULT_FILTERS, priceMin: 500 })).toHaveLength(0);
  });
});

describe("applyFilters — rating and favourite", () => {
  it("filters by rating (OR within type)", () => {
    const twoStar = makeEntry({ rating: 2 });
    const threeStar = makeEntry({ rating: 3 });
    const unrated = makeEntry({});
    const result = applyFilters([twoStar, threeStar, unrated], { ...DEFAULT_FILTERS, ratings: [3] });
    expect(result).toHaveLength(1);
  });

  it("filters by favoritesOnly", () => {
    const fav = makeEntry({ isFavorite: true, rating: 3 });
    const notFav = makeEntry({ rating: 2 });
    const result = applyFilters([fav, notFav], { ...DEFAULT_FILTERS, favoritesOnly: true });
    expect(result).toHaveLength(1);
    expect(result[0].item.isFavorite).toBe(true);
  });
});

describe("filtersFromSearchParams", () => {
  function params(init: Record<string, string | string[]>): URLSearchParams {
    const p = new URLSearchParams();
    for (const [key, value] of Object.entries(init)) {
      const values = Array.isArray(value) ? value : [value];
      for (const v of values) p.append(key, v);
    }
    return p;
  }

  it("returns DEFAULT_FILTERS for empty params", () => {
    expect(filtersFromSearchParams(new URLSearchParams())).toEqual(DEFAULT_FILTERS);
  });

  it("seeds distilleries from URL", () => {
    const result = filtersFromSearchParams(params({ distillery: ["Ardbeg", "Laphroaig"] }));
    expect(result.distilleries).toEqual(["Ardbeg", "Laphroaig"]);
  });

  it("seeds ratings as numbers", () => {
    const result = filtersFromSearchParams(params({ rating: "3" }));
    expect(result.ratings).toEqual([3]);
  });

  it("seeds favoritesOnly from favorites=true", () => {
    const result = filtersFromSearchParams(params({ favorites: "true" }));
    expect(result.favoritesOnly).toBe(true);
  });

  it("seeds priceMin and priceMax as numbers", () => {
    const result = filtersFromSearchParams(params({ priceMin: "500", priceMax: "2000" }));
    expect(result.priceMin).toBe(500);
    expect(result.priceMax).toBe(2000);
  });

  it("ignores invalid rating values", () => {
    const result = filtersFromSearchParams(params({ rating: "99" }));
    expect(result.ratings).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd c:/Users/erweeb/Desktop/Whisky && npx vitest run tests/collection-filters.test.ts
```

Expected: FAIL — module `@/lib/collection-filters` not found.

- [ ] **Step 3: Create `lib/collection-filters.ts`**

```ts
import type { CollectionViewItem } from "@/lib/types";

export interface CollectionFilters {
  tags: string[];
  brands: string[];
  distilleries: string[];
  bottlers: string[];
  countries: string[];
  purchaseSources: string[];
  fillStates: string[];
  abvBuckets: string[];
  ageBuckets: string[];
  priceMin?: number;
  priceMax?: number;
  ratings: number[];
  favoritesOnly: boolean;
}

export const DEFAULT_FILTERS: CollectionFilters = {
  tags: [],
  brands: [],
  distilleries: [],
  bottlers: [],
  countries: [],
  purchaseSources: [],
  fillStates: [],
  abvBuckets: [],
  ageBuckets: [],
  ratings: [],
  favoritesOnly: false
};

export function hasActiveFilters(filters: CollectionFilters): boolean {
  return (
    filters.tags.length > 0 ||
    filters.brands.length > 0 ||
    filters.distilleries.length > 0 ||
    filters.bottlers.length > 0 ||
    filters.countries.length > 0 ||
    filters.purchaseSources.length > 0 ||
    filters.fillStates.length > 0 ||
    filters.abvBuckets.length > 0 ||
    filters.ageBuckets.length > 0 ||
    filters.ratings.length > 0 ||
    filters.favoritesOnly ||
    filters.priceMin !== undefined ||
    filters.priceMax !== undefined
  );
}

function abvBucketMatches(abv: number | undefined, buckets: string[]): boolean {
  if (buckets.length === 0) return true;
  if (abv === undefined) return false;
  return buckets.some((bucket) => {
    if (bucket === "under-46") return abv < 46;
    if (bucket === "46-55") return abv >= 46 && abv <= 55;
    if (bucket === "55-plus") return abv > 55;
    return false;
  });
}

function ageBucketMatches(ageStatement: number | undefined, nasTag: boolean, buckets: string[]): boolean {
  if (buckets.length === 0) return true;
  return buckets.some((bucket) => {
    if (bucket === "nas") return nasTag || ageStatement === undefined;
    if (bucket === "under-12") return ageStatement !== undefined && ageStatement < 12;
    if (bucket === "12-18") return ageStatement !== undefined && ageStatement >= 12 && ageStatement <= 18;
    if (bucket === "18-25") return ageStatement !== undefined && ageStatement > 18 && ageStatement <= 25;
    if (bucket === "25-plus") return ageStatement !== undefined && ageStatement > 25;
    return false;
  });
}

export function applyFilters(
  collection: CollectionViewItem[],
  filters: CollectionFilters
): CollectionViewItem[] {
  return collection.filter((entry) => {
    const { expression, item } = entry;

    if (filters.tags.length > 0 && !filters.tags.some((t) => expression.tags.includes(t))) return false;
    if (filters.brands.length > 0 && (!expression.brand || !filters.brands.includes(expression.brand)))
      return false;
    if (
      filters.distilleries.length > 0 &&
      (!expression.distilleryName || !filters.distilleries.includes(expression.distilleryName))
    )
      return false;
    if (
      filters.bottlers.length > 0 &&
      (!expression.bottlerName || !filters.bottlers.includes(expression.bottlerName))
    )
      return false;
    if (
      filters.countries.length > 0 &&
      (!expression.country || !filters.countries.includes(expression.country))
    )
      return false;
    if (
      filters.purchaseSources.length > 0 &&
      (!item.purchaseSource || !filters.purchaseSources.includes(item.purchaseSource))
    )
      return false;
    if (filters.fillStates.length > 0 && !filters.fillStates.includes(item.fillState)) return false;
    if (!abvBucketMatches(expression.abv, filters.abvBuckets)) return false;
    if (!ageBucketMatches(expression.ageStatement, expression.tags.includes("nas"), filters.ageBuckets))
      return false;
    if (filters.priceMin !== undefined && (item.purchasePrice === undefined || item.purchasePrice < filters.priceMin))
      return false;
    if (filters.priceMax !== undefined && (item.purchasePrice === undefined || item.purchasePrice > filters.priceMax))
      return false;
    if (filters.ratings.length > 0 && (!item.rating || !filters.ratings.includes(item.rating))) return false;
    if (filters.favoritesOnly && !item.isFavorite) return false;

    return true;
  });
}

export function filtersFromSearchParams(params: URLSearchParams): CollectionFilters {
  const filters: CollectionFilters = { ...DEFAULT_FILTERS };

  const distilleries = params.getAll("distillery");
  if (distilleries.length > 0) filters.distilleries = distilleries;

  const bottlers = params.getAll("bottler");
  if (bottlers.length > 0) filters.bottlers = bottlers;

  const brands = params.getAll("brand");
  if (brands.length > 0) filters.brands = brands;

  const countries = params.getAll("country");
  if (countries.length > 0) filters.countries = countries;

  const tags = params.getAll("tag");
  if (tags.length > 0) filters.tags = tags;

  const fillStates = params.getAll("fillState");
  if (fillStates.length > 0) filters.fillStates = fillStates;

  const ratings = params
    .getAll("rating")
    .map(Number)
    .filter((n) => n >= 1 && n <= 3);
  if (ratings.length > 0) filters.ratings = ratings;

  if (params.get("favorites") === "true") filters.favoritesOnly = true;

  const abv = params.getAll("abv");
  if (abv.length > 0) filters.abvBuckets = abv;

  const age = params.getAll("age");
  if (age.length > 0) filters.ageBuckets = age;

  const priceMin = params.get("priceMin");
  if (priceMin !== null) filters.priceMin = Number(priceMin);

  const priceMax = params.get("priceMax");
  if (priceMax !== null) filters.priceMax = Number(priceMax);

  return filters;
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npx vitest run tests/collection-filters.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/collection-filters.ts tests/collection-filters.test.ts
git commit -m "feat: add collection filter logic and URL seed parser"
```

---

## Task 2: MultiSelectCombobox component

**Files:**
- Create: `components/multi-select-combobox.tsx`

- [ ] **Step 1: Create the component**

Create `components/multi-select-combobox.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

interface MultiSelectComboboxProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export function MultiSelectCombobox({
  label,
  options,
  selected,
  onChange,
  placeholder
}: MultiSelectComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = options.filter((opt) => opt.toLowerCase().includes(query.toLowerCase()));

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  function handleClose() {
    setOpen(false);
    setQuery("");
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayValue =
    selected.length === 0
      ? ""
      : selected.length <= 2
        ? selected.join(", ")
        : `${selected.length} selected`;

  return (
    <div className="msc-container" ref={containerRef}>
      <label className="msc-label">{label}</label>
      <button
        aria-expanded={open}
        className={`msc-trigger${selected.length > 0 ? " msc-trigger-active" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        <span className="msc-value">{displayValue || placeholder || `All ${label}`}</span>
        <span className="msc-arrow">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="msc-dropdown">
          <input
            autoFocus
            className="msc-search"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") handleClose();
            }}
            placeholder="Search..."
            type="text"
            value={query}
          />
          <ul className="msc-list">
            {filtered.length === 0 ? (
              <li className="msc-empty">No matches</li>
            ) : (
              filtered.map((opt) => (
                <li key={opt}>
                  <label className="msc-option">
                    <input checked={selected.includes(opt)} onChange={() => toggle(opt)} type="checkbox" />
                    {opt}
                  </label>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/multi-select-combobox.tsx
git commit -m "feat: add MultiSelectCombobox component"
```

---

## Task 3: Update CollectionBrowser — state, options, filtering

**Files:**
- Modify: `components/collection-browser.tsx`

Replace the entire file with the version below. This task wires up state, options, and the updated `useMemo` — the panel UI comes in Task 4.

- [ ] **Step 1: Replace `components/collection-browser.tsx`**

```tsx
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
      const label = v === "under-46" ? "< 46%" : v === "46-55" ? "46–55%" : "55%+";
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

  // Panel and chips UI will be added in Task 4 and Task 5.
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd c:/Users/erweeb/Desktop/Whisky && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/collection-browser.tsx
git commit -m "feat: add filter state, options, and updated filtering to CollectionBrowser"
```

---

## Task 4: Filter panel UI

**Files:**
- Modify: `components/collection-browser.tsx`

Replace the return statement (starting from `return (`) with the full version that includes the filter panel. All state/logic added in Task 3 remains unchanged — only the JSX is extended.

- [ ] **Step 1: Replace the return statement in `components/collection-browser.tsx`**

Add import at the top (alongside existing imports):
```tsx
import { MultiSelectCombobox } from "@/components/multi-select-combobox";
```

Replace the `return (` block:

```tsx
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
                    onClick={() => {
                      const next = filters.fillStates.includes(state)
                        ? filters.fillStates.filter((s) => s !== state)
                        : [...filters.fillStates, state];
                      setFilters((f) => ({ ...f, fillStates: next }));
                    }}
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
                    onClick={() => {
                      const next = filters.abvBuckets.includes(value)
                        ? filters.abvBuckets.filter((b) => b !== value)
                        : [...filters.abvBuckets, value];
                      setFilters((f) => ({ ...f, abvBuckets: next }));
                    }}
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
                    onClick={() => {
                      const next = filters.ageBuckets.includes(value)
                        ? filters.ageBuckets.filter((b) => b !== value)
                        : [...filters.ageBuckets, value];
                      setFilters((f) => ({ ...f, ageBuckets: next }));
                    }}
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
                    onClick={() => {
                      const next = filters.ratings.includes(star)
                        ? filters.ratings.filter((r) => r !== star)
                        : [...filters.ratings, star];
                      setFilters((f) => ({ ...f, ratings: next }));
                    }}
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/collection-browser.tsx
git commit -m "feat: add filter panel UI and active filter chips to CollectionBrowser"
```

---

## Task 5: CSS styles

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Update `.shelf-toolbar` grid to accommodate the Filters button**

Find the existing `.shelf-toolbar` rule (around line 1149):

```css
.shelf-toolbar {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 16px;
  align-items: end;
}
```

Change `grid-template-columns` to:

```css
.shelf-toolbar {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px auto;
  gap: 16px;
  align-items: end;
}
```

- [ ] **Step 2: Add all new CSS rules after the existing `.shelf-toolbar` block**

Append the following after the `.shelf-search input, .shelf-filter select { ... }` block:

```css
/* ── Filter toggle button (toolbar) ───────────────────────────────────────── */
.filter-toggle-btn {
  height: 44px;
  padding: 0 18px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: rgba(8, 5, 4, 0.76);
  color: var(--muted);
  font-size: 0.9rem;
  letter-spacing: 0.03em;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.15s, color 0.15s;
}

.filter-toggle-btn:hover {
  border-color: rgba(231, 191, 116, 0.35);
  color: var(--text);
}

.filter-toggle-btn-active {
  border-color: var(--accent);
  color: var(--accent);
}

/* ── Filter panel ─────────────────────────────────────────────────────────── */
.filter-panel {
  position: relative;
  z-index: 2;
  margin-top: 12px;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--panel-soft);
  backdrop-filter: blur(12px);
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

/* ── Filter field (toggle groups + price) ─────────────────────────────────── */
.filter-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-field-label {
  font-size: 0.8rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--muted);
}

.filter-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.filter-toggle {
  padding: 5px 11px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font-size: 0.82rem;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.filter-toggle:hover {
  border-color: rgba(231, 191, 116, 0.35);
  color: var(--text);
}

.filter-toggle.active {
  border-color: var(--accent);
  background: rgba(212, 157, 69, 0.14);
  color: var(--accent);
}

.filter-price {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-price input {
  width: 80px;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: rgba(8, 5, 4, 0.76);
  color: var(--text);
  font-size: 0.88rem;
}

.filter-price input:focus {
  outline: none;
  border-color: rgba(231, 191, 116, 0.4);
}

.filter-price-sep {
  color: var(--muted);
  font-size: 0.9rem;
}

/* ── Active filter chips ──────────────────────────────────────────────────── */
.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  position: relative;
  z-index: 1;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border: 1px solid rgba(212, 157, 69, 0.4);
  border-radius: 999px;
  background: rgba(212, 157, 69, 0.1);
  color: var(--accent);
  font-size: 0.82rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.filter-chip:hover {
  background: rgba(212, 157, 69, 0.2);
  border-color: var(--accent);
}

.filter-chip-clear {
  border-color: rgba(213, 198, 173, 0.3);
  background: transparent;
  color: var(--muted);
}

.filter-chip-clear:hover {
  color: var(--text);
  border-color: var(--muted);
  background: transparent;
}

/* ── MultiSelectCombobox ──────────────────────────────────────────────────── */
.msc-container {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.msc-label {
  font-size: 0.8rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--muted);
}

.msc-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: rgba(8, 5, 4, 0.76);
  color: var(--muted);
  font-size: 0.88rem;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, color 0.15s;
}

.msc-trigger:hover {
  border-color: rgba(231, 191, 116, 0.35);
  color: var(--text);
}

.msc-trigger-active {
  border-color: rgba(212, 157, 69, 0.5);
  color: var(--text);
}

.msc-value {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.msc-arrow {
  font-size: 0.65rem;
  color: var(--muted);
  flex-shrink: 0;
}

.msc-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 100;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--panel);
  backdrop-filter: blur(16px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.msc-search {
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-bottom: 1px solid var(--line);
  background: transparent;
  color: var(--text);
  font-size: 0.88rem;
}

.msc-search:focus {
  outline: none;
}

.msc-list {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  max-height: 200px;
  overflow-y: auto;
}

.msc-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  color: var(--text-dark);
  font-size: 0.88rem;
  cursor: pointer;
  transition: background 0.1s;
}

.msc-option:hover {
  background: rgba(212, 157, 69, 0.08);
  color: var(--text);
}

.msc-option input[type="checkbox"] {
  accent-color: var(--accent);
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.msc-empty {
  padding: 10px 12px;
  color: var(--muted);
  font-size: 0.85rem;
  font-style: italic;
}

/* ── Responsive: filter grid ──────────────────────────────────────────────── */
@media (max-width: 1080px) {
  .filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .filter-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 3: Also update the existing `@media (max-width: 1080px)` block for `.shelf-toolbar`**

Find this existing block (around line 1490):

```css
@media (max-width: 1080px) {
  .grid.columns-3,
  .split-hero,
  .bottle-detail-hero,
  .detail-fields-grid,
  .form-grid,
  .shelf-toolbar {
    grid-template-columns: 1fr;
  }
```

The `.shelf-toolbar` in that list overrides to `1fr`. Leave that in place — on mobile the toolbar stacks vertically, which is fine.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat: add CSS for filter panel, combobox, toggle buttons, and chips"
```

---

## Task 6: Add Suspense boundary in CollectionPage

**Files:**
- Modify: `app/collection/page.tsx`

`CollectionBrowser` now uses `useSearchParams`, which requires a `Suspense` boundary above it in the Next.js App Router.

- [ ] **Step 1: Update `app/collection/page.tsx`**

```tsx
import { Suspense } from "react";

import { CollectionBrowser } from "@/components/collection-browser";
import { getCollectionView } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function CollectionPage({
  searchParams
}: {
  searchParams?: Promise<{ notice?: string }>;
}) {
  const collection = await getCollectionView();
  const params = (await searchParams) ?? {};

  return (
    <div className="page">
      <section className="hero collection-hero">
        <p className="eyebrow">Collection</p>
        <h1>Walk the shelf like you are choosing your next pour.</h1>
        <p>
          Dark wood, back-bar glow, and bottle-first browsing. Search by distillery, region, release
          series, or your flavor tags while quick details appear on hover.
        </p>
      </section>
      {params.notice === "deleted" ? (
        <div className="status-note status-note-success">
          Bottle deleted from your collection.
        </div>
      ) : null}
      <Suspense fallback={<div className="loading-state">Loading collection…</div>}>
        <CollectionBrowser collection={collection} />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass including the new `collection-filters` tests.

- [ ] **Step 4: Commit**

```bash
git add app/collection/page.tsx
git commit -m "feat: wrap CollectionBrowser in Suspense for useSearchParams support"
```

---

## Task 7: Manual verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify the filter panel opens and closes**

Navigate to `http://localhost:3000/collection`. Click "Filters". The panel should expand below the toolbar. Click again to collapse.

- [ ] **Step 3: Verify comboboxes work**

Open the filter panel. Click "Distillery". Type a few letters — the list should narrow. Check a value. The trigger should show the selected name and the badge on the "Filters" button should show "(1)".

- [ ] **Step 4: Verify chips and clear**

With a filter active, collapse the panel. The chip should remain visible. Click "×" on the chip — it should disappear and the collection should update. Select multiple filters, then click "Clear all".

- [ ] **Step 5: Verify bucket toggles**

Click ABV toggles — "< 46%" and "55%+". Only bottles in those ranges should remain. Click again to deactivate.

- [ ] **Step 6: Verify URL seeding**

Navigate to `http://localhost:3000/collection?distillery=Lagavulin` (or whatever distillery name is in your collection). The distillery filter should be pre-applied on load.

- [ ] **Step 7: Verify existing filters still work**

The text search and status dropdown (Owned/Wishlist) should still function alongside the new filters.
