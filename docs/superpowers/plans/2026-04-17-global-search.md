# Global Search Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global search icon to the top nav that expands inline, shows a live top-5 bottle dropdown, and navigates to the collection tab on Enter or the bottle detail page on click.

**Architecture:** A new `GlobalSearch` client component lives inside `TopNav`. It calls a new `/api/collection/search` GET endpoint on each debounced keystroke. The search haystack logic is extracted from `CollectionBrowser` into `lib/collection-filters.ts` so both share it. `CollectionBrowser` reads a `q` URL param on mount to pre-populate its input when navigated to via Enter.

**Tech Stack:** Next.js App Router, React hooks (`useState`, `useEffect`, `useRef`), `useRouter` + `usePathname` from `next/navigation`, Vitest for tests.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `lib/collection-filters.ts` | Add exported `buildSearchHaystack` |
| Modify | `components/collection-browser.tsx` | Import `buildSearchHaystack` from lib; read `q` param on mount |
| Create | `app/api/collection/search/route.ts` | GET endpoint returning top 5 matches |
| Create | `components/global-search.tsx` | Client component: icon → expand → dropdown |
| Modify | `components/top-nav.tsx` | Render `GlobalSearch` in the nav |
| Modify | `app/globals.css` | Styles for search icon, expanded state, dropdown |
| Modify | `tests/collection-filters.test.ts` | Tests for `buildSearchHaystack` |

---

## Task 1: Extract `buildSearchHaystack` into `lib/collection-filters.ts`

**Files:**
- Modify: `lib/collection-filters.ts`
- Modify: `components/collection-browser.tsx`
- Modify: `tests/collection-filters.test.ts`

- [ ] **Step 1: Write the failing test in `tests/collection-filters.test.ts`**

Add these cases after the existing imports and `makeEntry` helper (which already exists in that file):

```typescript
import { applyFilters, buildSearchHaystack, DEFAULT_FILTERS, filtersFromSearchParams, hasActiveFilters } from "@/lib/collection-filters";

// Add at the bottom of the file:
describe("buildSearchHaystack", () => {
  it("includes name, distillery, country, tags, fill state", () => {
    const entry = makeEntry({
      distilleryName: "Ardbeg",
      country: "Scotland",
      tags: ["peated", "islay"],
      fillState: "open"
    });
    entry.expression.name = "Ardbeg 10 Year";
    const haystack = buildSearchHaystack(entry);
    expect(haystack).toContain("ardbeg 10 year");
    expect(haystack).toContain("ardbeg");
    expect(haystack).toContain("scotland");
    expect(haystack).toContain("peated");
    expect(haystack).toContain("islay");
    expect(haystack).toContain("open");
  });

  it("is lowercase", () => {
    const entry = makeEntry({ distilleryName: "GlenLivet" });
    expect(buildSearchHaystack(entry)).not.toMatch(/[A-Z]/);
  });

  it("excludes undefined fields gracefully", () => {
    const entry = makeEntry({});
    expect(() => buildSearchHaystack(entry)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd "c:\Users\erweeb\Desktop\Whisky" && npx vitest run tests/collection-filters.test.ts 2>&1 | tail -20
```

Expected: FAIL — `buildSearchHaystack` is not exported from `@/lib/collection-filters`.

- [ ] **Step 3: Add `buildSearchHaystack` to `lib/collection-filters.ts`**

Add this function at the bottom of `lib/collection-filters.ts` (before the last line):

```typescript
export function buildSearchHaystack(entry: CollectionViewItem): string {
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd "c:\Users\erweeb\Desktop\Whisky" && npx vitest run tests/collection-filters.test.ts 2>&1 | tail -20
```

Expected: PASS — all tests green.

- [ ] **Step 5: Update `components/collection-browser.tsx` to import from lib**

Remove the inline `buildSearchHaystack` function (lines 12–29 in current file) and add the import:

```typescript
import { applyFilters, buildSearchHaystack, DEFAULT_FILTERS, filtersFromSearchParams } from "@/lib/collection-filters";
```

- [ ] **Step 6: Verify the build still compiles**

```bash
cd "c:\Users\erweeb\Desktop\Whisky" && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
cd "c:\Users\erweeb\Desktop\Whisky" && git add lib/collection-filters.ts components/collection-browser.tsx tests/collection-filters.test.ts && git commit -m "refactor: extract buildSearchHaystack to lib/collection-filters"
```

---

## Task 2: Pre-populate `CollectionBrowser` from `q` URL param

**Files:**
- Modify: `components/collection-browser.tsx`

- [ ] **Step 1: Update the `query` useState initialiser to read the `q` param**

In `components/collection-browser.tsx`, change the existing `query` state line from:

```typescript
const [query, setQuery] = useState("");
```

to:

```typescript
const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
```

`searchParams` is already available — it's used for `filtersFromSearchParams` on the line just below.

- [ ] **Step 2: Verify type-check passes**

```bash
cd "c:\Users\erweeb\Desktop\Whisky" && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd "c:\Users\erweeb\Desktop\Whisky" && git add components/collection-browser.tsx && git commit -m "feat: pre-populate collection search from q URL param"
```

---

## Task 3: New API route `/api/collection/search`

**Files:**
- Create: `app/api/collection/search/route.ts`

- [ ] **Step 1: Create the file**

```typescript
// app/api/collection/search/route.ts
import { NextResponse } from "next/server";

import { getSessionMode } from "@/lib/auth";
import { buildSearchHaystack } from "@/lib/collection-filters";
import { getCollectionView } from "@/lib/repository";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sessionMode = await getSessionMode();
  if (sessionMode !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const collection = await getCollectionView();

  const results = collection
    .filter((entry) => buildSearchHaystack(entry).includes(q))
    .slice(0, 5)
    .map((entry) => ({
      id: entry.item.id,
      name: entry.expression.name,
      status: entry.item.status,
      fillState: entry.item.fillState
    }));

  return NextResponse.json({ results });
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
cd "c:\Users\erweeb\Desktop\Whisky" && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd "c:\Users\erweeb\Desktop\Whisky" && git add app/api/collection/search/route.ts && git commit -m "feat: add /api/collection/search endpoint"
```

---

## Task 4: Create `GlobalSearch` component

**Files:**
- Create: `components/global-search.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/global-search.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SearchResult = {
  id: string;
  name: string;
  status: "owned" | "wishlist";
  fillState: "sealed" | "open" | "finished";
};

const STATUS_LABEL: Record<string, string> = {
  owned: "In Collection",
  wishlist: "Wishlist"
};

const FILL_LABEL: Record<string, string> = {
  sealed: "Sealed",
  open: "Open",
  finished: "Finished"
};

export function GlobalSearch() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Click-outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/collection/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) return;
        const data = await res.json() as { results: SearchResult[] };
        setResults(data.results);
      } catch {
        // Non-fatal: leave stale results
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function close() {
    setIsOpen(false);
    setQuery("");
    setResults([]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "Enter" && query.trim().length >= 2) {
      router.push(`/collection?q=${encodeURIComponent(query.trim())}`);
      close();
    }
  }

  function handleResultClick(id: string) {
    router.push(`/collection/${id}`);
    close();
  }

  return (
    <div className="global-search" ref={containerRef}>
      {!isOpen ? (
        <button
          aria-label="Open search"
          className="global-search-icon"
          onClick={() => setIsOpen(true)}
          type="button"
        >
          <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" x2="16.65" y1="21" y2="16.65" />
          </svg>
        </button>
      ) : (
        <div className="global-search-expanded">
          <input
            aria-label="Search your collection"
            autoComplete="off"
            className="global-search-input"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search bottles, distilleries, tags..."
            ref={inputRef}
            type="search"
            value={query}
          />
          <button
            aria-label="Close search"
            className="global-search-close"
            onClick={close}
            type="button"
          >
            ✕
          </button>

          {(results.length > 0 || query.length >= 2) && (
            <div className="global-search-dropdown">
              {results.length === 0 ? (
                <div className="global-search-empty">No bottles found</div>
              ) : (
                <>
                  {results.map((result) => (
                    <button
                      className="global-search-result"
                      key={result.id}
                      onClick={() => handleResultClick(result.id)}
                      type="button"
                    >
                      <span className="global-search-result-name">{result.name}</span>
                      <span className="global-search-result-meta">
                        <span className="global-search-badge">{STATUS_LABEL[result.status] ?? result.status}</span>
                        <span className="global-search-fill">{FILL_LABEL[result.fillState] ?? result.fillState}</span>
                      </span>
                    </button>
                  ))}
                  <div className="global-search-footer">
                    Press Enter to see all {results.length === 5 ? "5+" : results.length} results in Collection →
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
cd "c:\Users\erweeb\Desktop\Whisky" && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd "c:\Users\erweeb\Desktop\Whisky" && git add components/global-search.tsx && git commit -m "feat: add GlobalSearch client component"
```

---

## Task 5: Wire `GlobalSearch` into `TopNav`

**Files:**
- Modify: `components/top-nav.tsx`

- [ ] **Step 1: Import and render `GlobalSearch` in the nav**

Replace the entire content of `components/top-nav.tsx` with:

```typescript
"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

import { GlobalSearch } from "@/components/global-search";
import { PendingLink } from "@/components/navigation-feedback";

type NavItem = {
  href: string;
  label: string;
};

export function TopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="top-nav">
      <div className="top-nav-inner">
        <div className="top-nav-brand-block">
          <p className="eyebrow">Private Cellar</p>
          <PendingLink className="top-nav-brand" href="/" onClick={() => setIsOpen(false)}>
            Whisky Advisor
          </PendingLink>
        </div>

        <div className="top-nav-menu-wrap">
          <GlobalSearch />

          <button
            aria-controls="main-menu"
            aria-expanded={isOpen}
            aria-label="Open navigation menu"
            className={`menu-toggle${isOpen ? " menu-toggle-open" : ""}`}
            onClick={() => setIsOpen((current) => !current)}
            type="button"
          >
            <span />
            <span />
            <span />
          </button>

          <nav className={`menu-dropdown${isOpen ? " menu-dropdown-open" : ""}`} id="main-menu">
            <p className="menu-copy">
              Catalog your whiskies, track prices, and move between your private whisky tools quickly.
            </p>
            <div className="menu-links">
              {items.map((item) => (
                <PendingLink
                  className={`menu-link${pathname === item.href ? " menu-link-active" : ""}`}
                  href={item.href}
                  key={item.href}
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </PendingLink>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
cd "c:\Users\erweeb\Desktop\Whisky" && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd "c:\Users\erweeb\Desktop\Whisky" && git add components/top-nav.tsx && git commit -m "feat: wire GlobalSearch into TopNav"
```

---

## Task 6: Add CSS styles

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add styles after the `.top-nav-menu-wrap` block**

Find the line `.top-nav-menu-wrap {` in `app/globals.css` and add the following block after its closing `}`:

```css
/* Global Search */
.global-search {
  position: relative;
  display: flex;
  align-items: center;
}

.global-search-icon {
  width: 44px;
  height: 44px;
  border: 1px solid rgba(255, 225, 190, 0.14);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-dark);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, border-color 0.15s;
}

.global-search-icon:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 225, 190, 0.24);
}

.global-search-expanded {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  width: min(380px, 60vw);
}

.global-search-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 225, 190, 0.2);
  border-radius: 12px;
  padding: 10px 14px;
  color: var(--text);
  font-size: 0.9rem;
  outline: none;
}

.global-search-input:focus {
  border-color: rgba(212, 157, 69, 0.5);
  background: rgba(255, 255, 255, 0.07);
}

.global-search-input::-webkit-search-cancel-button {
  display: none;
}

.global-search-close {
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 1rem;
  padding: 4px 8px;
  line-height: 1;
}

.global-search-close:hover {
  color: var(--text);
}

.global-search-dropdown {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  right: 0;
  background: rgba(14, 18, 28, 0.98);
  border: 1px solid rgba(255, 225, 190, 0.12);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  z-index: 200;
  backdrop-filter: blur(18px);
  min-width: 320px;
}

.global-search-result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255, 225, 190, 0.06);
  color: var(--text);
  cursor: pointer;
  text-align: left;
  gap: 12px;
  transition: background 0.1s;
}

.global-search-result:last-of-type {
  border-bottom: none;
}

.global-search-result:hover {
  background: rgba(212, 157, 69, 0.08);
}

.global-search-result-name {
  font-size: 0.9rem;
  font-weight: 600;
  flex: 1;
}

.global-search-result-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.global-search-badge {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 20px;
  background: rgba(212, 157, 69, 0.15);
  border: 1px solid rgba(212, 157, 69, 0.3);
  color: var(--accent);
  white-space: nowrap;
}

.global-search-fill {
  font-size: 0.75rem;
  color: var(--muted);
  white-space: nowrap;
}

.global-search-empty {
  padding: 16px;
  text-align: center;
  color: var(--muted);
  font-size: 0.875rem;
}

.global-search-footer {
  padding: 10px 16px;
  text-align: center;
  font-size: 0.75rem;
  color: var(--muted);
  border-top: 1px solid rgba(255, 225, 190, 0.06);
}

/* Hide hamburger while search is expanded on mobile */
@media (max-width: 640px) {
  .global-search-expanded ~ .menu-toggle {
    display: none;
  }

  .global-search-expanded {
    width: 100%;
  }
}
```

- [ ] **Step 2: Start the dev server and verify visually**

```bash
cd "c:\Users\erweeb\Desktop\Whisky" && npm run dev
```

Open http://localhost:3000. Check:
1. Search icon appears in the nav to the left of the hamburger
2. Clicking the icon expands the search input
3. Typing 2+ characters shows a dropdown with results
4. Each result shows name, status badge, fill state
5. Clicking a result navigates to the bottle detail page
6. Pressing Enter navigates to `/collection?q=<query>` with results pre-filled
7. Pressing Escape closes and clears the search
8. Clicking outside closes the search

- [ ] **Step 3: Commit**

```bash
cd "c:\Users\erweeb\Desktop\Whisky" && git add app/globals.css && git commit -m "style: add global search styles"
```

---

## Task 7: Final integration test

- [ ] **Step 1: Run all tests**

```bash
cd "c:\Users\erweeb\Desktop\Whisky" && npx vitest run 2>&1 | tail -30
```

Expected: All tests pass, including the new `buildSearchHaystack` tests.

- [ ] **Step 2: Type-check the full project**

```bash
cd "c:\Users\erweeb\Desktop\Whisky" && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit if any final fixes were needed, otherwise done**

```bash
cd "c:\Users\erweeb\Desktop\Whisky" && git status
```

If clean, the feature is complete.
