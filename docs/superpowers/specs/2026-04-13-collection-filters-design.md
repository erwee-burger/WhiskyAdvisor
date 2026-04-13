# Collection Filter Bar — Design Spec

**Date:** 2026-04-13
**Status:** Approved

---

## Overview

Add a rich, space-efficient filter panel to the Collection page. The panel expands below the existing toolbar and supports 12 filter dimensions across the bottle and ownership data model. A separate `MultiSelectCombobox` component handles all searchable multi-select fields.

The stats page will later be able to link to `/collection?distillery=Ardbeg&rating=3` to arrive with filters pre-applied.

---

## Toolbar & Panel Layout

The existing **Status dropdown** (All / Owned / Wishlist) stays in the toolbar as-is — it is not moved into the filter panel. The existing `.shelf-toolbar` row gains a **"Filters" button** on the right edge of that same row. When clicked, a panel expands below the toolbar containing all 12 filters in a responsive 4-column grid (2 columns on mobile).

When one or more filters are active:
- **Active filter chips** appear between the toolbar and `.shelf-caption`, one chip per active value (e.g. `× Ardbeg`, `× 3 stars`, `× open`)
- A **"Clear all"** link appears at the end of the chip row
- The "Filters" button shows a **badge count** of active filter groups (e.g. "Filters (3)")

Closing the panel preserves active filters — the chips remain visible.

---

## The 12 Filters

| Filter | Control | Values |
|---|---|---|
| Tags | Searchable multi-select combobox | Built from collection tags |
| Brand | Searchable multi-select combobox | Built from collection |
| Distillery | Searchable multi-select combobox | Built from collection |
| Bottler | Searchable multi-select combobox | Built from collection |
| Country | Searchable multi-select combobox | Built from collection |
| Purchase source | Searchable multi-select combobox | Built from collection |
| Bottle state | Inline toggle buttons (multi-select) | Sealed / Open / Finished |
| Rating | Inline star buttons (multi-select) | ★ / ★★ / ★★★ |
| Favourite | Single toggle button | Show favourites only |
| ABV | Predefined bucket toggles (multi-select) | Under 46% / 46–55% / 55%+ |
| Age statement | Predefined bucket toggles (multi-select) | NAS / Under 12 / 12–18 / 18–25 / 25+ |
| Purchase price | Min / max number inputs | ZAR |

**Filter logic:** AND across filter types, OR within the same type. Example: Distillery = (Ardbeg OR Laphroaig) AND Rating = (3).

Combobox options are derived at render time from the live collection — only values that actually exist appear as options.

---

## `MultiSelectCombobox` Component

A new reusable component at `components/multi-select-combobox.tsx`.

**Props:**
```ts
interface MultiSelectComboboxProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}
```

**Behaviour:**
- Renders a text input; typing narrows the dropdown list (case-insensitive substring match)
- Dropdown shows matching options, each with a checkbox
- Selected items shown in the field as a comma-separated list up to 2 names, then "3 selected" for more
- Escape closes the dropdown; arrow keys navigate options; Enter/Space toggles selection
- Clicking outside closes the dropdown

---

## Filter State Shape

Defined as `CollectionFilters` in `components/collection-browser.tsx`:

```ts
interface CollectionFilters {
  tags: string[];
  brands: string[];
  distilleries: string[];
  bottlers: string[];
  countries: string[];
  purchaseSources: string[];
  fillStates: string[];       // "sealed" | "open" | "finished"
  abvBuckets: string[];       // "under-46" | "46-55" | "55-plus"
  ageBuckets: string[];       // "nas" | "under-12" | "12-18" | "18-25" | "25-plus"
  priceMin?: number;
  priceMax?: number;
  ratings: number[];          // 1 | 2 | 3
  favoritesOnly: boolean;
}

const DEFAULT_FILTERS: CollectionFilters = {
  tags: [], brands: [], distilleries: [], bottlers: [],
  countries: [], purchaseSources: [], fillStates: [],
  abvBuckets: [], ageBuckets: [],
  ratings: [], favoritesOnly: false,
};
```

A filter is considered **active** if its array is non-empty, or `favoritesOnly` is true, or `priceMin`/`priceMax` is set.

---

## URL Seeding (Stats → Collection Navigation)

On mount, `CollectionBrowser` reads `useSearchParams()` and maps known params into the initial filter state. The component must be wrapped in a `Suspense` boundary at the page level for this to work with Next.js App Router.

**Supported URL params:**

| Param | Maps to |
|---|---|
| `distillery` | `distilleries[]` (repeatable) |
| `bottler` | `bottlers[]` (repeatable) |
| `brand` | `brands[]` (repeatable) |
| `country` | `countries[]` (repeatable) |
| `tag` | `tags[]` (repeatable) |
| `fillState` | `fillStates[]` (repeatable) |
| `rating` | `ratings[]` (repeatable) |
| `favorites` | `favoritesOnly` (truthy string) |
| `abv` | `abvBuckets[]` (repeatable) |
| `age` | `ageBuckets[]` (repeatable) |
| `priceMin` | `priceMin` |
| `priceMax` | `priceMax` |

Example link from stats page: `/collection?distillery=Ardbeg&distillery=Laphroaig&rating=3`

Filter state is **not written back to the URL** during interaction — seeding on mount only.

---

## Filtering Logic

All filtering runs in a single `useMemo` over the `collection` prop. Each active filter is an AND gate; within a filter, multiple values are OR'd.

```ts
const visible = useMemo(() => {
  return collection.filter((entry) => {
    // existing status + text filters remain
    // plus each new filter dimension checked in turn
  });
}, [collection, query, status, filters]);
```

ABV bucket matching uses the expression's `abv` field with numeric range checks. Age bucket matching uses `ageStatement` and `isNas`. Price matching uses `purchasePrice`. Rating and favourite use `item.rating` and `item.isFavorite`. All combobox filters match against their respective expression fields.

---

## Files to Create / Modify

| File | Change |
|---|---|
| `components/multi-select-combobox.tsx` | New — reusable searchable multi-select |
| `components/collection-browser.tsx` | Add filter state, panel, chips, URL seeding, updated `useMemo` |
| `app/collection/page.tsx` | Wrap `CollectionBrowser` in `Suspense` for `useSearchParams` |
| `app/globals.css` | Styles for filter panel, chips, toggle buttons, combobox dropdown |

---

## Out of Scope

- Writing filter state back to the URL on interaction (may be added later)
- Sorting the collection (separate feature)
- Stats page changes (stats → collection links are a separate task)
