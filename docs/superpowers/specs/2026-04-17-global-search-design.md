# Global Search Bar — Design Spec

**Date:** 2026-04-17
**Status:** Approved

## Overview

A global search accessible from any page via a search icon in the top nav. Clicking the icon expands the nav inline to a full-width input with a live dropdown showing the top 5 matching bottles. Pressing Enter navigates to the collection tab with the query pre-filled. Clicking a result navigates directly to that bottle's detail page.

---

## UI Behaviour

- **Collapsed state:** Search icon (🔍) sits in the top nav bar to the left of the hamburger menu
- **Expanded state:** The nav replaces the brand block with a full-width search input; a results dropdown appears below the nav bar
- **Mobile:** Expanded search takes full width; hamburger is hidden while search is open
- **Closing:** Escape key, or clicking outside the search area, closes and clears the input

### Result rows (top 5)

Each row shows:
- Bottle name
- Status badge (In Collection / Wishlist / Finished)
- Fill state (Full / Three Quarters / Half / Quarter / Empty)
- Clicking a row → navigates to `/collection/<itemId>`

### Footer row

`Press Enter to see all N results →` — pressing Enter navigates to `/collection?q=<query>`

---

## Architecture

### New component: `GlobalSearch`

Client component. Owned by `TopNav`. Manages:
- `isOpen` — collapsed vs expanded state
- `query` — current input value
- `results` — top 5 matches from API
- Debounced API call (250ms) on query change
- Keyboard handling (Enter, Escape)
- Click-outside detection to close

### New API route: `/api/collection/search`

`GET /api/collection/search?q=<query>`

- Returns top 5 `CollectionViewItem` matches as lightweight objects: `{ id, name, status, fillState }`
- Uses the shared `buildSearchHaystack` function
- Skips call if query is shorter than 2 characters (enforced client-side)
- No authentication change needed — inherits existing session check

### Shared utility: `buildSearchHaystack`

Currently defined inline in `components/collection-browser.tsx`. Extract to `lib/collection-filters.ts` so both `CollectionBrowser` and the new API route use the same logic.

### Collection tab integration

`CollectionBrowser` reads a `q` search param on mount and pre-populates its existing search input. No new UI needed on the collection tab — the existing search input and filter system handles display from there.

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| Query < 2 chars | No API call, dropdown hidden |
| No matches | Dropdown shows "No bottles found" |
| Loading | 250ms debounce; no spinner (fast local data) |
| Click outside | Closes and clears input |
| Mobile | Search takes full width; hamburger hidden while open |

---

## Files to Create

- `components/global-search.tsx` — new client component
- `app/api/collection/search/route.ts` — new API route

## Files to Modify

- `lib/collection-filters.ts` — add exported `buildSearchHaystack`
- `components/collection-browser.tsx` — remove inline `buildSearchHaystack`, import from lib, read `q` param on mount
- `components/top-nav.tsx` — render `GlobalSearch` alongside the existing nav elements; no new props needed since `GlobalSearch` self-fetches via the API route
- `app/globals.css` — styles for expanded search state and result dropdown
