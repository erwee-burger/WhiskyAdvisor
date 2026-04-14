# Guest Read-Only Access

**Date:** 2026-04-12
**Status:** Ready to implement
**Scope:** UI/middleware only — no database changes, no new env vars, no API changes

---

## Overview

The app currently requires the `whisky_access` cookie on every page when `APP_LOCK_ENABLED=true`. This plan adds a guest tier: unauthenticated visitors may browse `/collection`, `/collection/[itemId]`, and `/news` in a read-only view. All write surfaces, personal data, and owner tools are hidden from guests. The unlock flow is unchanged — guests who want owner access enter the token at `/unlock` as before.

---

## Architecture

- Guest identity = **absence** of the `whisky_access` cookie. No separate guest cookie.
- A new server utility `lib/auth.ts` exports `getSessionMode()`, used in Server Components and page files to thread `isOwner` down to client components as a prop.
- `middleware.ts` is updated to pass through guest-viewable paths without a valid cookie.
- All API routes remain owner-only via the existing middleware 401 — no API changes needed because read-only pages fetch data server-side.
- Dev mode (`APP_LOCK_ENABLED` not `"true"` or `APP_ACCESS_TOKEN` unset) continues to behave as owner everywhere.

### Key note on `lib/env.ts`

`getServerEnv()` already parses `APP_LOCK_ENABLED` into a boolean via Zod. `getSessionMode()` in `lib/auth.ts` should read directly from `process.env` (as `middleware.ts` does) rather than calling `getServerEnv()`, because `getServerEnv()` may not be safe to call in all Server Component contexts without triggering the Zod schema. Keep `getSessionMode` self-contained.

---

## Files Affected

| File | Action |
|------|--------|
| `lib/auth.ts` | Create |
| `middleware.ts` | Modify |
| `app/layout.tsx` | Modify |
| `app/news/page.tsx` | Modify |
| `components/news-feed.tsx` | Modify |
| `components/news-item.tsx` | Modify |
| `app/collection/[itemId]/page.tsx` | Modify |
| `components/bottle-record-editor.tsx` | Modify |

---

## Task 1: Create `lib/auth.ts`

**New file.**

```typescript
import { cookies } from "next/headers";

export async function getSessionMode(): Promise<"owner" | "guest"> {
  const lockEnabled = process.env.APP_LOCK_ENABLED?.toLowerCase() === "true";
  const accessToken = process.env.APP_ACCESS_TOKEN;

  // Dev mode or unconfigured — treat as owner
  if (!lockEnabled || !accessToken) {
    return "owner";
  }

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get("whisky_access")?.value;

  return cookieToken === accessToken ? "owner" : "guest";
}
```

This mirrors the exact same logic already in `middleware.ts` lines 19–34. The function is `async` because `cookies()` from `next/headers` returns a Promise in Next.js 15.

---

## Task 2: Update `middleware.ts`

Add a helper and an extra early-return branch. Minimal diff:

```typescript
// After isPublicPath(), add:
function isGuestViewablePath(pathname: string) {
  return (
    pathname === "/collection" ||
    pathname.startsWith("/collection/") ||
    pathname === "/news"
  );
}
```

In the main `middleware` function, insert after the `if (isPublicPath(pathname))` block and before the cookie comparison:

```typescript
if (isGuestViewablePath(pathname)) {
  return NextResponse.next();
}
```

The API 401 branch continues to protect all API routes for guests — correct, since SSR pages fetch server-side and guests are not offered write-action buttons.

Export `isGuestViewablePath` so it can be unit-tested directly.

---

## Task 3: Update `app/layout.tsx`

Convert `RootLayout` to `async` and thread session mode into nav items.

```typescript
import { getSessionMode } from "@/lib/auth";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  assertProductionEnv();

  const sessionMode = await getSessionMode();

  const navItems =
    sessionMode === "owner"
      ? [
          { href: "/", label: "Dashboard" },
          { href: "/collection", label: "Collection" },
          { href: "/add", label: "Add Bottle" },
          { href: "/analytics", label: "Analytics" },
          { href: "/advisor", label: "Advisor" },
          { href: "/compare", label: "Compare" },
          { href: "/export", label: "Export" },
          { href: "/news", label: "News" }
        ]
      : [
          { href: "/collection", label: "Collection" },
          { href: "/news", label: "News" }
        ];

  return (
    <html lang="en">
      <body>
        <NavigationFeedbackProvider>
          <div className="app-shell">
            <TopNav items={navItems} />
            <main className="main-content">{children}</main>
          </div>
        </NavigationFeedbackProvider>
      </body>
    </html>
  );
}
```

`TopNav` already accepts `items: NavItem[]` — no changes to `top-nav.tsx` needed.

---

## Task 4: Update `app/news/page.tsx`

Call `getSessionMode()` and pass `isOwner` to `<NewsFeed>`:

```typescript
import { getSessionMode } from "@/lib/auth";

export default async function NewsPage() {
  const sessionMode = await getSessionMode();
  // ... existing data fetching ...

  return (
    <div className="page">
      {/* ... existing hero section ... */}
      <NewsFeed
        initialSpecials={specials}
        initialNewArrivals={newArrivals}
        initialSummaryCards={summaryCards}
        initialFetchedAt={fetchedAt}
        initialStale={stale}
        initialPreferences={preferences}
        isOwner={sessionMode === "owner"}
      />
    </div>
  );
}
```

---

## Task 5: Update `components/news-feed.tsx`

Add `isOwner: boolean` to `NewsFeedProps`. This is a `"use client"` component so the prop comes from the Server Component as an initial value.

```typescript
interface NewsFeedProps {
  // ... existing props ...
  isOwner: boolean;
}
```

**Conditional render changes:**

1. Refresh button — wrap in `{isOwner && (...)}`
2. Budget settings button — wrap in `{isOwner && (...)}`
3. Preferences panel (`showPrefs` block) — wrap in `{isOwner && (...)}`

**Pass `showBudget` to each `NewsItem`:**

```tsx
<NewsItem key={item.id} item={item} kind="special" showBudget={isOwner} />
<NewsItem key={item.id} item={item} kind="new_release" showBudget={isOwner} />
```

---

## Task 6: Update `components/news-item.tsx`

Add `showBudget: boolean` to props. Gate the budget badge on it:

```typescript
interface Props {
  item: NewsFeedItem;
  kind: "special" | "new_release";
  showBudget: boolean;
}

export function NewsItem({ item, kind, showBudget }: Props) {
  const isBadgeNew = kind === "new_release";
  const badgeClass = `news-card-badge news-card-badge-${item.budgetFit.replace("_", "-")}`;

  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="news-card">
      <div className="news-card-top">
        <span className="news-card-retailer">{RETAILER_LABELS[item.source] || item.source}</span>
        <div className="news-card-badges">
          {isBadgeNew && <span className="news-card-badge news-card-badge-new">New</span>}
          {showBudget && <span className={badgeClass}>{BUDGET_LABELS[item.budgetFit]}</span>}
        </div>
      </div>
      {/* rest of card unchanged */}
    </a>
  );
}
```

The "New" badge is unconditional. `item.budgetFit` still exists in data but is not rendered for guests.

---

## Task 7: Update `app/collection/[itemId]/page.tsx`

```typescript
import { getSessionMode } from "@/lib/auth";

export default async function ItemDetailPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const [entry, sessionMode] = await Promise.all([
    getItemById(itemId),
    getSessionMode()
  ]);

  if (!entry) {
    notFound();
  }

  const isOwner = sessionMode === "owner";

  return (
    <div className="page">
      <BottleRecordEditor entry={entry} isOwner={isOwner} />

      {isOwner && (
        <section className="panel stack">
          <div className="section-title">
            <div>
              <h2>My rating</h2>
              <p>Rate this bottle and mark it as a favorite if it stands out.</p>
            </div>
          </div>
          <BottleRating
            isFavorite={entry.item.isFavorite}
            itemId={entry.item.id}
            rating={entry.item.rating}
          />
        </section>
      )}

      {isOwner && (
        <BottleChat bottleId={entry.item.id} bottleName={entry.expression.name} />
      )}
    </div>
  );
}
```

`Promise.all` avoids sequential awaits for two independent async calls.

---

## Task 8: Update `components/bottle-record-editor.tsx`

Add `isOwner?: boolean` prop defaulting to `true` for backward compatibility.

### 8a. Prop signature

```typescript
export function BottleRecordEditor({ entry, isOwner = true }: { entry: CollectionViewItem; isOwner?: boolean }) {
```

### 8b. Hero: image pencil button

Gate the edit button div:
```tsx
{isOwner && (
  <div className="detail-field-tools">
    <button aria-label="Edit front image" className="detail-icon-button" onClick={() => enterEditMode("frontImage")} title="Edit front image" type="button">
      <PencilIcon />
    </button>
  </div>
)}
```

### 8c. Hero: purchase price status-note

The hero shows a two-column grid with purchase price and description. Gate only the price cell:
```tsx
<div className="grid columns-2" style={{ marginTop: "16px" }}>
  {isOwner && (
    <div className="status-note">
      {formatFieldValue("purchasePrice", formValues)}
    </div>
  )}
  <div className="status-note">
    {formValues.description.trim() || "No bottle description saved yet"}
  </div>
</div>
```

The description note is public bottle information — it remains visible to guests.

### 8d. Hero: hero-actions section

Gate the entire block containing Save/Cancel/Delete:
```tsx
{isOwner && (
  <div className="hero-actions">
    {/* Save/Cancel/Delete buttons */}
  </div>
)}
```

### 8e. Field rows: pencil and sparkle buttons in `renderFieldRow`

In the `detail-field-tools` div inside `renderFieldRow`:
```tsx
<div className="detail-field-tools">
  {isOwner && aiFieldId ? (
    <button aria-label={`Ask AI about ${definition.label}`} className="detail-icon-button" onClick={() => requestSuggestion(aiFieldId)} title={`Ask AI about ${definition.label}`} type="button">
      <SparkleIcon />
    </button>
  ) : null}
  {isOwner && (
    <button aria-label={`Edit ${definition.label}`} className="detail-icon-button" onClick={() => enterEditMode(definition.id)} title={`Edit ${definition.label}`} type="button">
      <PencilIcon />
    </button>
  )}
</div>
```

### 8f. Collection section: filter private fields

At the `collectionFields` derivation, add a guest filter:
```typescript
const GUEST_HIDDEN_COLLECTION_FIELDS: BottleDetailFieldId[] = [
  "purchasePrice",
  "purchaseCurrency",
  "personalNotes"
];

const collectionFields = bottleDetailFieldDefinitions
  .filter((field) => field.section === "collection")
  .filter((field) => isOwner || !GUEST_HIDDEN_COLLECTION_FIELDS.includes(field.id));
```

This keeps `status`, `fillState`, `purchaseDate`, and `purchaseSource` visible as read-only for guests. Personal and financial fields are hidden.

### 8g. No change to `renderEditorValue`

With `isOwner=false`, no pencil/sparkle buttons are rendered, so `enterEditMode` is never called, `isEditing` stays `false`, and `renderEditorValue` is never invoked. No defensive guard needed.

---

## Verification Checklist

### Middleware
- [ ] `GET /collection` with no cookie → 200
- [ ] `GET /collection/abc123` with no cookie → 200
- [ ] `GET /news` with no cookie → 200
- [ ] `GET /` with no cookie → redirect to `/unlock`
- [ ] `GET /advisor` with no cookie → redirect to `/unlock`
- [ ] `POST /api/news/refresh` with no cookie → 401
- [ ] `GET /api/items/abc123` with no cookie → 401

### News page (guest)
- [ ] Refresh button not rendered
- [ ] Budget settings button not rendered
- [ ] Preferences panel not rendered
- [ ] Budget fit badges absent from all NewsItem cards
- [ ] "New" badges visible on new arrival cards
- [ ] GPT "Today's picks" cards visible
- [ ] Specials and new arrivals listed

### Collection item page (guest)
- [ ] `BottleRating` section not rendered
- [ ] `BottleChat` section not rendered
- [ ] Image pencil button not rendered
- [ ] Purchase price status-note not rendered in hero
- [ ] Delete button not rendered
- [ ] Save/Cancel buttons not rendered
- [ ] All field pencil and sparkle buttons not rendered
- [ ] `purchasePrice`, `purchaseCurrency`, `personalNotes` fields absent from Collection section
- [ ] `status`, `fillState`, `purchaseDate`, `purchaseSource` visible (read-only display values)
- [ ] Identity and Specs sections fully visible

### Navigation
- [ ] Guest nav shows exactly: Collection, News
- [ ] Owner nav shows all 8 tabs
- [ ] "Private Cellar" eyebrow present in both modes

### Owner regression
- [ ] All pages accessible with valid cookie
- [ ] Edit pencils, sparkle buttons, Delete button all present
- [ ] Budget badges present on news items
- [ ] Rating and chat sections present on item page
- [ ] Purchase price visible in hero

---

## Tests to Add

```typescript
// lib/auth.test.ts
describe("getSessionMode", () => {
  it("returns 'owner' when APP_LOCK_ENABLED is not true");
  it("returns 'owner' when APP_ACCESS_TOKEN is unset");
  it("returns 'owner' when cookie matches token");
  it("returns 'guest' when cookie is absent");
  it("returns 'guest' when cookie does not match token");
});

// middleware.test.ts
describe("isGuestViewablePath", () => {
  it("returns true for /collection");
  it("returns true for /collection/some-id");
  it("returns true for /news");
  it("returns false for /");
  it("returns false for /advisor");
  it("returns false for /api/items/abc");
});
```

---

## What NOT to Change

- `app/unlock/page.tsx` and `components/unlock-form.tsx` — unchanged
- `app/api/auth/unlock/route.ts` — unchanged
- All other API routes — already return 401 for guests via existing middleware
- `app/collection/page.tsx` — no write operations or personal data; no changes needed
- `components/news-summary-cards.tsx` — GPT editorial cards are not personal/budget data; shown to guests
- `app/advisor/page.tsx`, `app/analytics/page.tsx`, `app/page.tsx`, `app/add/page.tsx`, `app/compare/page.tsx`, `app/export/page.tsx` — no changes; middleware redirects guests to `/unlock`

---

## Architecture Notes

- **No new env vars** — uses existing `APP_LOCK_ENABLED` and `APP_ACCESS_TOKEN`
- **No database changes** — purely UI/middleware filtering
- **No API surface changes** — all API routes remain owner-only
- **Backward compatible** — `getSessionMode()` returns `"owner"` in dev mode; `isOwner` props default to `true`
- **No guest cookie** — guests identified by absence of auth cookie; no new cookie lifecycle to manage
- **SSR-safe** — `getSessionMode()` uses `cookies()` from `next/headers`, only called in Server Components and async page functions
- **`lib/env.ts` independence** — `getSessionMode` reads `process.env` directly (matching `middleware.ts`) rather than going through `getServerEnv()`
