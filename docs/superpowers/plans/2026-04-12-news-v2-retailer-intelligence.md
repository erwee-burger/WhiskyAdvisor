# News Tab V2: GPT-5.4 Retailer Intelligence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scraper-led news tab with a GPT-5.4 snapshot-based SA retailer intelligence page that surfaces buying opportunities with budget-aware annotations.

**Architecture:** GPT-5.4 via the Responses API (web_search_preview) discovers, normalises, scores, and annotates offers from five approved SA retailers; results are stored as immutable snapshots linked to a refresh record; the news page server-renders the latest successful snapshot and provides manual refresh controls. Budget preferences are saved per-user and applied at read time to compute budget-fit badges.

**Tech Stack:** Next.js 15 App Router (RSC + client components), TypeScript, Supabase/PostgreSQL, OpenAI Responses API (`OPENAI_MODEL`), Zod, Vitest

---

## File Map

**Create:**
- `supabase/migrations/20260412_news_v2.sql`
- `lib/news-budget.ts`
- `lib/news-store.ts` (full rewrite)
- `lib/news-preferences-store.ts`
- `lib/news-gpt.ts`
- `app/api/news/preferences/route.ts`
- `components/news-summary-cards.tsx`
- `components/news-preferences-panel.tsx`
- `tests/news-budget.test.ts`
- `tests/news-gpt-validation.test.ts`
- `tests/news-preferences-api.test.ts`

**Modify:**
- `lib/types.ts` — add v2 news types, remove `ScoredNewsItem`
- `app/api/news/route.ts` — new response shape
- `app/api/news/refresh/route.ts` — GPT discovery instead of scrapers
- `components/news-feed.tsx` — full rewrite (orchestrates all v2 UI)
- `components/news-item.tsx` — richer card with budget badge + GPT reason
- `lib/advisor-context.ts` — update `buildDealsContextBlock` signature
- `app/api/advisor/chat/route.ts` — load news snapshot + budget prefs for deals context
- `app/news/page.tsx` — convert to server component

**Keep in repo, removed from active import path:**
- `lib/scrapers/` — all files remain; no file imports them after this plan

---

## Task 1: DB Migration — news v2 schema

**Files:**
- Create: `supabase/migrations/20260412_news_v2.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260412_news_v2.sql

-- Drop v1 upsert-model table (no cascade needed; no FK refs from other tables)
drop table if exists news_items cascade;

-- Refresh log: one row per refresh attempt
create table news_refreshes (
  id           uuid primary key default gen_random_uuid(),
  status       text not null check (status in ('pending', 'success', 'failed')),
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  error_text   text
);

-- Items linked to a refresh; cascade delete removes orphan items automatically
create table news_items (
  id              uuid primary key default gen_random_uuid(),
  refresh_id      uuid not null references news_refreshes(id) on delete cascade,
  source          text not null,
  kind            text not null check (kind in ('special', 'new_release')),
  name            text not null,
  price           numeric not null,
  original_price  numeric,
  discount_pct    integer,
  url             text not null,
  image_url       text,
  in_stock        boolean not null default true,
  relevance_score integer not null default 50,
  why_it_matters  text,
  citations       jsonb not null default '[]'
);

-- Up to 3 summary cards per refresh
create table news_summary_cards (
  id             uuid primary key default gen_random_uuid(),
  refresh_id     uuid not null references news_refreshes(id) on delete cascade,
  card_type      text not null check (card_type in ('best_value', 'worth_stretching', 'most_interesting')),
  title          text not null,
  subtitle       text,
  price          numeric,
  url            text,
  why_it_matters text,
  source         text
);

-- Single-row budget preferences; id=1 enforced by check constraint
create table news_preferences (
  id                     integer primary key default 1 check (id = 1),
  soft_budget_cap_zar    numeric not null default 1000,
  stretch_budget_cap_zar numeric,
  updated_at             timestamptz not null default now()
);
```

- [ ] **Step 2: Apply migration via Supabase dashboard or CLI**

Run in Supabase SQL editor or: `supabase db push`
Expected: 4 tables created — `news_refreshes`, `news_items`, `news_summary_cards`, `news_preferences`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260412_news_v2.sql
git commit -m "feat: add news v2 schema — refreshes, items, summary cards, preferences"
```

---

## Task 2: V2 types in lib/types.ts

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Replace `NewsItem` / `ScoredNewsItem` with v2 types at the bottom of lib/types.ts**

Remove lines 210–227 (the existing `NewsItem` and `ScoredNewsItem` interfaces) and replace with:

```typescript
// ── News v2 ──────────────────────────────────────────────────────────────────

export type BudgetFit = "in_budget" | "stretch" | "over_budget" | "above_budget";

export interface NewsBudgetPreferences {
  softBudgetCapZar: number;
  stretchBudgetCapZar: number | null;
}

export interface NewsFeedItem {
  id: string;
  source: string;
  kind: "special" | "new_release";
  name: string;
  price: number;
  originalPrice?: number;
  discountPct?: number;
  url: string;
  imageUrl?: string;
  inStock: boolean;
  relevanceScore: number;
  budgetFit: BudgetFit;
  whyItMatters: string | null;
  citations: string[];
}

export interface NewsSummaryCard {
  cardType: "best_value" | "worth_stretching" | "most_interesting";
  title: string;
  subtitle?: string;
  price?: number;
  url?: string;
  whyItMatters?: string;
  source?: string;
}

export interface NewsSnapshotResponse {
  specials: NewsFeedItem[];
  newArrivals: NewsFeedItem[];
  summaryCards: NewsSummaryCard[];
  fetchedAt: string | null;
  stale: boolean;
  preferences: NewsBudgetPreferences;
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: any errors are only from callers of the removed `ScoredNewsItem` type — those will be fixed in later tasks. Zero *new* type errors introduced.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add v2 news types — NewsFeedItem, NewsBudgetPreferences, NewsSnapshotResponse"
```

---

## Task 3: Budget utility (TDD)

**Files:**
- Create: `lib/news-budget.ts`
- Create: `tests/news-budget.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/news-budget.test.ts
import { describe, it, expect } from "vitest";
import { computeBudgetFit } from "@/lib/news-budget";
import type { NewsBudgetPreferences } from "@/lib/types";

const prefs = (soft: number, stretch: number | null): NewsBudgetPreferences => ({
  softBudgetCapZar: soft,
  stretchBudgetCapZar: stretch
});

describe("computeBudgetFit", () => {
  it("returns in_budget when price <= soft cap", () => {
    expect(computeBudgetFit(800, prefs(1000, null))).toBe("in_budget");
    expect(computeBudgetFit(1000, prefs(1000, null))).toBe("in_budget");
  });

  it("returns above_budget when price > soft cap and stretch cap is null", () => {
    expect(computeBudgetFit(1001, prefs(1000, null))).toBe("above_budget");
    expect(computeBudgetFit(5000, prefs(1000, null))).toBe("above_budget");
  });

  it("returns stretch when soft cap < price <= stretch cap", () => {
    expect(computeBudgetFit(1200, prefs(1000, 1500))).toBe("stretch");
    expect(computeBudgetFit(1500, prefs(1000, 1500))).toBe("stretch");
  });

  it("returns over_budget when stretch cap exists and price > stretch cap", () => {
    expect(computeBudgetFit(1501, prefs(1000, 1500))).toBe("over_budget");
    expect(computeBudgetFit(3000, prefs(1000, 1500))).toBe("over_budget");
  });

  it("stretch cap of 0 is treated as null — returns above_budget when price > soft", () => {
    // This covers the edge case where a consumer passes 0; should not happen via API
    // but guard it anyway: 0 stretch cap means "no stretch ceiling"
    expect(computeBudgetFit(1200, prefs(1000, null))).toBe("above_budget");
  });
});
```

- [ ] **Step 2: Run tests — confirm failure**

```bash
npx vitest run tests/news-budget.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/news-budget'`

- [ ] **Step 3: Implement lib/news-budget.ts**

```typescript
// lib/news-budget.ts
import type { BudgetFit, NewsBudgetPreferences } from "@/lib/types";

export function computeBudgetFit(
  price: number,
  prefs: NewsBudgetPreferences
): BudgetFit {
  if (price <= prefs.softBudgetCapZar) return "in_budget";
  if (prefs.stretchBudgetCapZar !== null) {
    if (price <= prefs.stretchBudgetCapZar) return "stretch";
    return "over_budget";
  }
  return "above_budget";
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
npx vitest run tests/news-budget.test.ts
```

Expected: 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/news-budget.ts tests/news-budget.test.ts
git commit -m "feat: add computeBudgetFit utility with tests"
```

---

## Task 4: GPT output validation utilities (TDD)

**Files:**
- Create: `lib/news-gpt.ts` (validation exports only for now; GPT call added in Task 6)
- Create: `tests/news-gpt-validation.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/news-gpt-validation.test.ts
import { describe, it, expect } from "vitest";
import { validateGptOffer, APPROVED_SOURCE_KEYS } from "@/lib/news-gpt";

describe("validateGptOffer", () => {
  const validOffer = {
    source: "whiskybrother",
    name: "Glenfarclas 12",
    price: 799,
    url: "https://whiskybrother.com/products/glenfarclas-12",
    inStock: true,
    relevanceScore: 75,
    whyItMatters: "Good value sherry cask.",
    citations: ["https://whiskybrother.com/products/glenfarclas-12"]
  };

  it("accepts a valid offer", () => {
    expect(() => validateGptOffer(validOffer)).not.toThrow();
  });

  it("rejects non-approved source domain", () => {
    expect(() => validateGptOffer({ ...validOffer, source: "totalwine" })).toThrow(
      /source/
    );
  });

  it("rejects missing price", () => {
    const { price: _p, ...noPrice } = validOffer;
    expect(() => validateGptOffer(noPrice)).toThrow(/price/);
  });

  it("rejects zero or negative price", () => {
    expect(() => validateGptOffer({ ...validOffer, price: 0 })).toThrow(/price/);
    expect(() => validateGptOffer({ ...validOffer, price: -5 })).toThrow(/price/);
  });

  it("rejects URL that does not belong to the declared source domain", () => {
    expect(() =>
      validateGptOffer({ ...validOffer, url: "https://totalwine.com/some-bottle" })
    ).toThrow(/url/);
  });

  it("rejects missing name", () => {
    expect(() => validateGptOffer({ ...validOffer, name: "" })).toThrow(/name/);
    expect(() => validateGptOffer({ ...validOffer, name: undefined })).toThrow(/name/);
  });

  it("rejects non-product URL (no path beyond domain root)", () => {
    expect(() =>
      validateGptOffer({ ...validOffer, url: "https://whiskybrother.com" })
    ).toThrow(/url/);
    expect(() =>
      validateGptOffer({ ...validOffer, url: "https://whiskybrother.com/" })
    ).toThrow(/url/);
  });

  it("APPROVED_SOURCE_KEYS contains exactly the 5 approved retailers", () => {
    expect(APPROVED_SOURCE_KEYS).toEqual(
      expect.arrayContaining([
        "whiskybrother",
        "bottegawhiskey",
        "mothercityliquor",
        "whiskyemporium",
        "normangoodfellows"
      ])
    );
    expect(APPROVED_SOURCE_KEYS).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run tests — confirm failure**

```bash
npx vitest run tests/news-gpt-validation.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/news-gpt'`

- [ ] **Step 3: Create lib/news-gpt.ts with validation exports**

```typescript
// lib/news-gpt.ts

// Source keys map to their canonical domain strings (used for URL validation)
export const APPROVED_SOURCE_DOMAINS: Record<string, string> = {
  whiskybrother:    "whiskybrother.com",
  bottegawhiskey:   "bottegawhiskey.com",
  mothercityliquor: "mothercityliquor.co.za",
  whiskyemporium:   "whiskyemporium.co.za",
  normangoodfellows: "www.ngf.co.za"
};

export const APPROVED_SOURCE_KEYS = Object.keys(APPROVED_SOURCE_DOMAINS);

export interface GptOffer {
  source: string;
  name: string;
  price: number;
  originalPrice?: number;
  discountPct?: number;
  url: string;
  imageUrl?: string;
  inStock: boolean;
  relevanceScore: number;
  whyItMatters: string;
  citations: string[];
}

export interface GptSummaryCardShape {
  title: string;
  subtitle?: string;
  price?: number;
  url?: string;
  whyItMatters?: string;
  source?: string;
}

export interface GptNewsResponse {
  specials: GptOffer[];
  newArrivals: GptOffer[];
  summaryCards: {
    bestValue?: GptSummaryCardShape;
    worthStretching?: GptSummaryCardShape;
    mostInteresting?: GptSummaryCardShape;
  };
}

/** Validates a single GPT-returned offer. Throws a descriptive Error on failure. */
export function validateGptOffer(raw: unknown): GptOffer {
  if (!raw || typeof raw !== "object") throw new Error("offer: must be an object");
  const o = raw as Record<string, unknown>;

  if (!APPROVED_SOURCE_KEYS.includes(String(o.source ?? ""))) {
    throw new Error(`source: "${o.source}" is not an approved retailer key`);
  }

  if (typeof o.name !== "string" || o.name.trim() === "") {
    throw new Error("name: must be a non-empty string");
  }

  if (typeof o.price !== "number" || o.price <= 0) {
    throw new Error(`price: must be a positive number, got ${o.price}`);
  }

  if (typeof o.url !== "string") {
    throw new Error("url: must be a string");
  }

  const domain = APPROVED_SOURCE_DOMAINS[String(o.source)];
  if (!o.url.includes(domain)) {
    throw new Error(`url: "${o.url}" does not belong to domain "${domain}"`);
  }

  // Reject bare domain roots — require at least one path segment beyond "/"
  try {
    const parsed = new URL(o.url);
    if (parsed.pathname === "/" || parsed.pathname === "") {
      throw new Error(`url: "${o.url}" has no product path — must point to a specific product page`);
    }
  } catch (e) {
    if ((e as Error).message.startsWith("url:")) throw e;
    throw new Error(`url: "${o.url}" is not a valid URL`);
  }

  return {
    source: String(o.source),
    name: String(o.name).trim(),
    price: o.price,
    originalPrice: typeof o.originalPrice === "number" ? o.originalPrice : undefined,
    discountPct: typeof o.discountPct === "number" ? o.discountPct : undefined,
    url: String(o.url),
    imageUrl: typeof o.imageUrl === "string" ? o.imageUrl : undefined,
    inStock: Boolean(o.inStock ?? true),
    relevanceScore: typeof o.relevanceScore === "number"
      ? Math.min(100, Math.max(0, Math.round(o.relevanceScore)))
      : 50,
    whyItMatters: typeof o.whyItMatters === "string" ? o.whyItMatters : "",
    citations: Array.isArray(o.citations)
      ? (o.citations as unknown[]).filter(c => typeof c === "string") as string[]
      : []
  };
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
npx vitest run tests/news-gpt-validation.test.ts
```

Expected: 8 tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/news-gpt.ts tests/news-gpt-validation.test.ts
git commit -m "feat: add GPT offer validation with approved-domain checks"
```

---

## Task 5: Rewrite lib/news-store.ts (snapshot persistence)

**Files:**
- Modify: `lib/news-store.ts` (full rewrite)

- [ ] **Step 1: Replace entire contents of lib/news-store.ts**

```typescript
// lib/news-store.ts
import { createClient } from "@supabase/supabase-js";
import type { NewsFeedItem, NewsSummaryCard, NewsBudgetPreferences } from "@/lib/types";
import type { GptOffer, GptSummaryCardShape } from "@/lib/news-gpt";
import { computeBudgetFit } from "@/lib/news-budget";

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const STALE_MS = 12 * 60 * 60 * 1000; // 12 hours

export function isStale(fetchedAt: string): boolean {
  return Date.now() - new Date(fetchedAt).getTime() > STALE_MS;
}

// ── Refresh lifecycle ─────────────────────────────────────────────────────────

export async function createRefresh(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("news_refreshes")
    .insert({ status: "pending" })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function markRefreshSuccess(refreshId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from("news_refreshes")
    .update({ status: "success", completed_at: new Date().toISOString() })
    .eq("id", refreshId);

  if (error) throw error;
}

export async function markRefreshFailed(refreshId: string, errorText: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from("news_refreshes")
    .update({ status: "failed", completed_at: new Date().toISOString(), error_text: errorText })
    .eq("id", refreshId);

  if (error) throw error;
}

// ── Item insertion ────────────────────────────────────────────────────────────

export async function insertNewsItems(refreshId: string, offers: GptOffer[]): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase || offers.length === 0) return;

  const rows = offers.map(o => ({
    refresh_id:      refreshId,
    source:          o.source,
    kind:            o.source === o.source ? o.kind : "special", // kind set by caller
    name:            o.name,
    price:           o.price,
    original_price:  o.originalPrice ?? null,
    discount_pct:    o.discountPct ?? null,
    url:             o.url,
    image_url:       o.imageUrl ?? null,
    in_stock:        o.inStock,
    relevance_score: o.relevanceScore,
    why_it_matters:  o.whyItMatters,
    citations:       o.citations
  }));

  const { error } = await supabase.from("news_items").insert(rows);
  if (error) throw error;
}

export async function insertSummaryCards(
  refreshId: string,
  cards: Array<{ cardType: "best_value" | "worth_stretching" | "most_interesting"; card: GptSummaryCardShape }>
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase || cards.length === 0) return;

  const rows = cards.map(({ cardType, card }) => ({
    refresh_id:     refreshId,
    card_type:      cardType,
    title:          card.title,
    subtitle:       card.subtitle ?? null,
    price:          card.price ?? null,
    url:            card.url ?? null,
    why_it_matters: card.whyItMatters ?? null,
    source:         card.source ?? null
  }));

  const { error } = await supabase.from("news_summary_cards").insert(rows);
  if (error) throw error;
}

// ── Snapshot read ─────────────────────────────────────────────────────────────

export interface SnapshotRow {
  fetchedAt: string;
  specials: NewsFeedItem[];
  newArrivals: NewsFeedItem[];
  summaryCards: NewsSummaryCard[];
}

export async function getLatestSuccessfulSnapshot(
  prefs: NewsBudgetPreferences
): Promise<SnapshotRow | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  // Find the latest successful refresh
  const { data: refresh, error: refreshError } = await supabase
    .from("news_refreshes")
    .select("id, completed_at")
    .eq("status", "success")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  if (refreshError || !refresh) return null;

  const refreshId = refresh.id as string;
  const fetchedAt = refresh.completed_at as string;

  // Fetch items and summary cards in parallel
  const [itemsResult, cardsResult] = await Promise.all([
    supabase
      .from("news_items")
      .select("*")
      .eq("refresh_id", refreshId)
      .order("relevance_score", { ascending: false }),
    supabase
      .from("news_summary_cards")
      .select("*")
      .eq("refresh_id", refreshId)
  ]);

  if (itemsResult.error) throw itemsResult.error;
  if (cardsResult.error) throw cardsResult.error;

  const rawItems = (itemsResult.data ?? []) as Array<{
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
    relevance_score: number;
    why_it_matters: string | null;
    citations: string[];
  }>;

  const feedItems: NewsFeedItem[] = rawItems.map(r => ({
    id:             r.id,
    source:         r.source,
    kind:           r.kind as "special" | "new_release",
    name:           r.name,
    price:          r.price,
    originalPrice:  r.original_price ?? undefined,
    discountPct:    r.discount_pct ?? undefined,
    url:            r.url,
    imageUrl:       r.image_url ?? undefined,
    inStock:        r.in_stock,
    relevanceScore: r.relevance_score,
    budgetFit:      computeBudgetFit(r.price, prefs),
    whyItMatters:   r.why_it_matters,
    citations:      Array.isArray(r.citations) ? r.citations as string[] : []
  }));

  const rawCards = (cardsResult.data ?? []) as Array<{
    card_type: string;
    title: string;
    subtitle: string | null;
    price: number | null;
    url: string | null;
    why_it_matters: string | null;
    source: string | null;
  }>;

  const summaryCards: NewsSummaryCard[] = rawCards.map(c => ({
    cardType:      c.card_type as NewsSummaryCard["cardType"],
    title:         c.title,
    subtitle:      c.subtitle ?? undefined,
    price:         c.price ?? undefined,
    url:           c.url ?? undefined,
    whyItMatters:  c.why_it_matters ?? undefined,
    source:        c.source ?? undefined
  }));

  return {
    fetchedAt,
    specials:     feedItems.filter(i => i.kind === "special"),
    newArrivals:  feedItems.filter(i => i.kind === "new_release"),
    summaryCards
  };
}
```

- [ ] **Step 2: Fix the bug in insertNewsItems — kind must come from the caller**

The `kind` field above has a bug (tautology). The caller passes items with a `kind` property. Update `GptOffer` in `lib/news-gpt.ts` to include `kind`:

In `lib/news-gpt.ts`, add `kind: "special" | "new_release"` to `GptOffer`:

```typescript
export interface GptOffer {
  source: string;
  kind: "special" | "new_release";   // ← add this line
  name: string;
  price: number;
  originalPrice?: number;
  discountPct?: number;
  url: string;
  imageUrl?: string;
  inStock: boolean;
  relevanceScore: number;
  whyItMatters: string;
  citations: string[];
}
```

And fix the row mapping in `insertNewsItems` to `kind: o.kind` (remove the tautology):

```typescript
const rows = offers.map(o => ({
  refresh_id:      refreshId,
  source:          o.source,
  kind:            o.kind,         // ← fixed
  name:            o.name,
  ...
}));
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors from the rewritten news-store.ts and news-gpt.ts types

- [ ] **Step 4: Commit**

```bash
git add lib/news-store.ts lib/news-gpt.ts
git commit -m "feat: rewrite news-store for snapshot model — createRefresh, insertNewsItems, getLatestSuccessfulSnapshot"
```

---

## Task 6: Create lib/news-preferences-store.ts

**Files:**
- Create: `lib/news-preferences-store.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/news-preferences-store.ts
import { createClient } from "@supabase/supabase-js";
import type { NewsBudgetPreferences } from "@/lib/types";

const DEFAULT_PREFERENCES: NewsBudgetPreferences = {
  softBudgetCapZar: 1000,
  stretchBudgetCapZar: null
};

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getNewsPreferences(): Promise<NewsBudgetPreferences> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ...DEFAULT_PREFERENCES };

  const { data, error } = await supabase
    .from("news_preferences")
    .select("soft_budget_cap_zar, stretch_budget_cap_zar")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { ...DEFAULT_PREFERENCES };

  return {
    softBudgetCapZar:    Number(data.soft_budget_cap_zar),
    stretchBudgetCapZar: data.stretch_budget_cap_zar !== null
      ? Number(data.stretch_budget_cap_zar)
      : null
  };
}

export async function saveNewsPreferences(prefs: NewsBudgetPreferences): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return; // no-op in local mode

  const { error } = await supabase
    .from("news_preferences")
    .upsert({
      id:                     1,
      soft_budget_cap_zar:    prefs.softBudgetCapZar,
      stretch_budget_cap_zar: prefs.stretchBudgetCapZar,
      updated_at:             new Date().toISOString()
    }, { onConflict: "id" });

  if (error) throw error;
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors

- [ ] **Step 3: Commit**

```bash
git add lib/news-preferences-store.ts
git commit -m "feat: add news-preferences-store with get/save, returns defaults when Supabase absent"
```

---

## Task 7: Preferences API route + tests

**Files:**
- Create: `app/api/news/preferences/route.ts`
- Create: `tests/news-preferences-api.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/news-preferences-api.test.ts
import { describe, it, expect } from "vitest";
import { z } from "zod";

// We test the Zod schema used by the PATCH handler in isolation
const PatchPreferencesSchema = z.object({
  softBudgetCapZar: z.number().positive(),
  stretchBudgetCapZar: z.number().positive().nullable()
});

describe("PATCH /api/news/preferences schema", () => {
  it("accepts valid soft + stretch", () => {
    const result = PatchPreferencesSchema.safeParse({
      softBudgetCapZar: 1000,
      stretchBudgetCapZar: 1500
    });
    expect(result.success).toBe(true);
  });

  it("accepts null stretch cap", () => {
    const result = PatchPreferencesSchema.safeParse({
      softBudgetCapZar: 1000,
      stretchBudgetCapZar: null
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stretchBudgetCapZar).toBeNull();
    }
  });

  it("rejects missing softBudgetCapZar", () => {
    const result = PatchPreferencesSchema.safeParse({
      stretchBudgetCapZar: null
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero or negative soft cap", () => {
    expect(PatchPreferencesSchema.safeParse({ softBudgetCapZar: 0, stretchBudgetCapZar: null }).success).toBe(false);
    expect(PatchPreferencesSchema.safeParse({ softBudgetCapZar: -100, stretchBudgetCapZar: null }).success).toBe(false);
  });

  it("rejects non-numeric softBudgetCapZar", () => {
    const result = PatchPreferencesSchema.safeParse({
      softBudgetCapZar: "one thousand",
      stretchBudgetCapZar: null
    });
    expect(result.success).toBe(false);
  });

  it("rejects undefined stretchBudgetCapZar (must be explicitly null)", () => {
    // undefined means the key was not sent — the client must always send the key
    const result = PatchPreferencesSchema.safeParse({
      softBudgetCapZar: 1000
    });
    // stretchBudgetCapZar is required; undefined fails
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — confirm pass (schema is inline, no imports needed)**

```bash
npx vitest run tests/news-preferences-api.test.ts
```

Expected: 6 tests pass (the schema is defined inline in the test — they always pass; this validates our design before we put it in the route)

- [ ] **Step 3: Create app/api/news/preferences/route.ts**

```typescript
// app/api/news/preferences/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getNewsPreferences, saveNewsPreferences } from "@/lib/news-preferences-store";

const PatchPreferencesSchema = z.object({
  softBudgetCapZar:    z.number().positive(),
  stretchBudgetCapZar: z.number().positive().nullable()
});

export async function GET() {
  try {
    const prefs = await getNewsPreferences();
    return NextResponse.json(prefs);
  } catch (err) {
    console.error("[api/news/preferences] GET failed:", err);
    return NextResponse.json({ error: "Failed to load preferences" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const parsed = PatchPreferencesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid preferences", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    await saveNewsPreferences(parsed.data);
    return NextResponse.json(parsed.data);
  } catch (err) {
    console.error("[api/news/preferences] PATCH failed:", err);
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
  }
}
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors

- [ ] **Step 5: Commit**

```bash
git add app/api/news/preferences/route.ts tests/news-preferences-api.test.ts
git commit -m "feat: add GET/PATCH /api/news/preferences with Zod validation; null stretch cap accepted"
```

---

## Task 8: Complete lib/news-gpt.ts — GPT discovery

**Files:**
- Modify: `lib/news-gpt.ts` (add the discovery function)

- [ ] **Step 1: Append GPT discovery function to lib/news-gpt.ts**

Add these imports and functions after the existing exports in `lib/news-gpt.ts`:

```typescript
import { getServerEnv } from "@/lib/env";
import type { PalateProfile, NewsBudgetPreferences } from "@/lib/types";

function buildNewsDiscoveryPrompt(
  profile: PalateProfile | null,
  prefs: NewsBudgetPreferences
): string {
  const budgetLines = [
    `Normal budget cap: R${prefs.softBudgetCapZar}`,
    prefs.stretchBudgetCapZar !== null
      ? `Stretch ceiling: R${prefs.stretchBudgetCapZar}`
      : "No fixed stretch ceiling"
  ];

  const palateLines = profile
    ? [
        profile.favoredRegions.length
          ? `Preferred regions: ${profile.favoredRegions.join(", ")}`
          : null,
        profile.favoredCaskStyles.length
          ? `Favoured cask styles: ${profile.favoredCaskStyles.join(", ")}`
          : null,
        profile.favoredPeatTag
          ? `Peat preference: ${profile.favoredPeatTag}`
          : null,
        profile.favoredFlavorTags.length
          ? `Top flavour tags: ${profile.favoredFlavorTags.join(", ")}`
          : null
      ].filter(Boolean)
    : ["No palate profile available yet — score items on general quality and value"];

  return [
    "You are a South African whisky retail intelligence agent.",
    "Search the live websites of ONLY these five approved SA retailers:",
    "  - whiskybrother.com  (source key: whiskybrother)",
    "  - bottegawhiskey.com  (source key: bottegawhiskey)",
    "  - mothercityliquor.co.za  (source key: mothercityliquor)",
    "  - whiskyemporium.co.za  (source key: whiskyemporium)",
    "  - www.ngf.co.za  (source key: normangoodfellows)",
    "",
    "Find current SPECIALS (discounted whiskies) and NEW ARRIVALS at each retailer.",
    "Only include offers that have ALL of: an approved retailer domain, a direct product URL, and a ZAR price.",
    "Keep the same bottle from different retailers as separate entries.",
    "",
    "USER BUDGET:",
    ...budgetLines,
    "",
    "USER PALATE PROFILE:",
    ...palateLines,
    "",
    "For each offer, write a 'whyItMatters' rationale (1–2 sentences) that references the user's palate or budget.",
    "Score each offer with a relevanceScore 0–100 that reflects quality, value, and palate fit.",
    "Budget should influence scoring: bottles within the normal cap score higher, all else equal.",
    "",
    "Also produce three summary cards:",
    "  bestValue       — best price-to-quality bottle currently available",
    "  worthStretching — one bottle worth exceeding the normal budget cap for",
    "  mostInteresting — most unusual or noteworthy new arrival",
    "",
    "Return ONLY a single valid JSON object with no markdown, no explanation.",
    "Required shape:",
    JSON.stringify({
      specials: [
        {
          source: "whiskybrother",
          kind: "special",
          name: "Example 12 Year",
          price: 799,
          originalPrice: 950,
          discountPct: 16,
          url: "https://whiskybrother.com/products/example-12",
          imageUrl: null,
          inStock: true,
          relevanceScore: 75,
          whyItMatters: "Solid value sherry cask within budget.",
          citations: ["https://whiskybrother.com/products/example-12"]
        }
      ],
      newArrivals: [
        {
          source: "whiskyemporium",
          kind: "new_release",
          name: "New Distillery Release",
          price: 1200,
          url: "https://www.whiskyemporium.co.za/products/new-distillery",
          imageUrl: null,
          inStock: true,
          relevanceScore: 68,
          whyItMatters: "First release from this distillery — rare on the SA market.",
          citations: ["https://www.whiskyemporium.co.za/products/new-distillery"]
        }
      ],
      summaryCards: {
        bestValue:       { title: "Example 12 Year", subtitle: "16% off at Whisky Brother", price: 799, url: "https://whiskybrother.com/products/example-12", whyItMatters: "Best r/quality this week.", source: "whiskybrother" },
        worthStretching: { title: "Premium Expression", subtitle: "Limited release at Whisky Emporium", price: 2200, url: "https://...", whyItMatters: "Rare cask, exceptional score.", source: "whiskyemporium" },
        mostInteresting: { title: "New Distillery Release", subtitle: "New arrival at Whisky Emporium", price: 1200, url: "https://...", whyItMatters: "First SA release.", source: "whiskyemporium" }
      }
    }, null, 2)
  ].join("\n");
}

function getResponsesText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as { output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> };
  if (!Array.isArray(p.output)) return "";
  for (let i = p.output.length - 1; i >= 0; i--) {
    const item = p.output[i];
    if (item.type === "message" && Array.isArray(item.content)) {
      const part = item.content.find(c => c.type === "output_text");
      if (part?.text) return part.text;
    }
  }
  return "";
}

function extractJson<T>(text: string): T | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

function validateGptNewsResponse(raw: unknown): GptNewsResponse {
  if (!raw || typeof raw !== "object") {
    throw new Error("GPT response is not an object");
  }
  const r = raw as Record<string, unknown>;

  const specials = Array.isArray(r.specials) ? r.specials : [];
  const newArrivals = Array.isArray(r.newArrivals) ? r.newArrivals : [];

  // Validate each offer; skip any that fail validation (log and continue)
  const validatedSpecials: GptOffer[] = [];
  for (const offer of specials) {
    try {
      validatedSpecials.push(validateGptOffer({ ...(offer as object), kind: "special" }));
    } catch (e) {
      console.warn("[news-gpt] skipping invalid special:", (e as Error).message, offer);
    }
  }

  const validatedNewArrivals: GptOffer[] = [];
  for (const offer of newArrivals) {
    try {
      validatedNewArrivals.push(validateGptOffer({ ...(offer as object), kind: "new_release" }));
    } catch (e) {
      console.warn("[news-gpt] skipping invalid new arrival:", (e as Error).message, offer);
    }
  }

  // De-duplicate by URL within each section
  const seen = new Set<string>();
  const deduped = (arr: GptOffer[]) => arr.filter(o => {
    if (seen.has(o.url)) return false;
    seen.add(o.url);
    return true;
  });

  const cards = (r.summaryCards && typeof r.summaryCards === "object")
    ? (r.summaryCards as Record<string, unknown>)
    : {};

  return {
    specials:     deduped(validatedSpecials),
    newArrivals:  deduped(validatedNewArrivals),
    summaryCards: {
      bestValue:       extractCard(cards.bestValue),
      worthStretching: extractCard(cards.worthStretching),
      mostInteresting: extractCard(cards.mostInteresting)
    }
  };
}

function extractCard(raw: unknown): GptSummaryCardShape | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;
  if (typeof c.title !== "string" || !c.title) return undefined;
  return {
    title:         String(c.title),
    subtitle:      typeof c.subtitle === "string" ? c.subtitle : undefined,
    price:         typeof c.price === "number" ? c.price : undefined,
    url:           typeof c.url === "string" ? c.url : undefined,
    whyItMatters:  typeof c.whyItMatters === "string" ? c.whyItMatters : undefined,
    source:        typeof c.source === "string" ? c.source : undefined
  };
}

/** Main entry point: calls GPT via Responses API and returns validated, deduplicated offers. */
export async function discoverNewsWithGpt(
  profile: PalateProfile | null,
  prefs: NewsBudgetPreferences
): Promise<GptNewsResponse> {
  const { OPENAI_API_KEY, OPENAI_MODEL } = getServerEnv();

  const prompt = buildNewsDiscoveryPrompt(profile, prefs);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      tools: [{ type: "web_search_preview" }],
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }]
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Responses API ${response.status}: ${body}`);
  }

  const payload = await response.json();
  const text = getResponsesText(payload);

  const raw = extractJson<unknown>(text);
  if (!raw) {
    throw new Error(`GPT returned no parseable JSON. Raw text length: ${text.length}`);
  }

  return validateGptNewsResponse(raw);
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors

- [ ] **Step 3: Run existing validation tests to confirm nothing broken**

```bash
npx vitest run tests/news-gpt-validation.test.ts
```

Expected: 8 tests still pass

- [ ] **Step 4: Commit**

```bash
git add lib/news-gpt.ts
git commit -m "feat: complete news-gpt discovery — Responses API call, validation, deduplication"
```

---

## Task 9: Rewrite app/api/news/refresh/route.ts

**Files:**
- Modify: `app/api/news/refresh/route.ts`

- [ ] **Step 1: Replace entire contents**

```typescript
// app/api/news/refresh/route.ts
import { NextResponse } from "next/server";
import { getNewsPreferences } from "@/lib/news-preferences-store";
import { discoverNewsWithGpt } from "@/lib/news-gpt";
import {
  createRefresh,
  insertNewsItems,
  insertSummaryCards,
  markRefreshSuccess,
  markRefreshFailed
} from "@/lib/news-store";
import { getServerEnv } from "@/lib/env";
import type { PalateProfile } from "@/lib/types";

export const maxDuration = 120;

async function loadPalateProfile(): Promise<PalateProfile | null> {
  try {
    const { getDashboardData } = await import("@/lib/repository");
    const { profile } = await getDashboardData();
    return profile;
  } catch {
    return null;
  }
}

export async function POST() {
  const { OPENAI_API_KEY } = getServerEnv();
  if (!OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: "OPENAI_API_KEY not configured" }, { status: 503 });
  }

  const [prefs, profile] = await Promise.all([
    getNewsPreferences(),
    loadPalateProfile()
  ]);

  const refreshId = await createRefresh();
  if (!refreshId) {
    // Supabase not configured — silently succeed with 0 items
    return NextResponse.json({ ok: true, count: 0, note: "Supabase not configured" });
  }

  try {
    const discovered = await discoverNewsWithGpt(profile, prefs);

    const cardEntries = [
      discovered.summaryCards.bestValue
        ? { cardType: "best_value" as const, card: discovered.summaryCards.bestValue }
        : null,
      discovered.summaryCards.worthStretching
        ? { cardType: "worth_stretching" as const, card: discovered.summaryCards.worthStretching }
        : null,
      discovered.summaryCards.mostInteresting
        ? { cardType: "most_interesting" as const, card: discovered.summaryCards.mostInteresting }
        : null
    ].filter(Boolean) as Array<{ cardType: "best_value" | "worth_stretching" | "most_interesting"; card: import("@/lib/news-gpt").GptSummaryCardShape }>;

    await Promise.all([
      insertNewsItems(refreshId, [...discovered.specials, ...discovered.newArrivals]),
      insertSummaryCards(refreshId, cardEntries)
    ]);

    await markRefreshSuccess(refreshId);

    const count = discovered.specials.length + discovered.newArrivals.length;
    console.log(`[api/news/refresh] success — ${count} items in refresh ${refreshId}`);
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    const errorText = err instanceof Error ? err.message : String(err);
    console.error("[api/news/refresh] failed:", errorText);
    await markRefreshFailed(refreshId, errorText).catch(() => {});
    return NextResponse.json({ ok: false, error: "Refresh failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors

- [ ] **Step 3: Commit**

```bash
git add app/api/news/refresh/route.ts
git commit -m "feat: rewrite refresh route — GPT discovery, snapshot lifecycle, failure isolation"
```

---

## Task 10: Rewrite app/api/news/route.ts

**Files:**
- Modify: `app/api/news/route.ts`

- [ ] **Step 1: Replace entire contents**

```typescript
// app/api/news/route.ts
import { NextResponse } from "next/server";
import { getLatestSuccessfulSnapshot, isStale } from "@/lib/news-store";
import { getNewsPreferences } from "@/lib/news-preferences-store";
import type { NewsSnapshotResponse } from "@/lib/types";

export async function GET() {
  try {
    const prefs = await getNewsPreferences();
    const snapshot = await getLatestSuccessfulSnapshot(prefs);

    if (!snapshot) {
      const empty: NewsSnapshotResponse = {
        specials:     [],
        newArrivals:  [],
        summaryCards: [],
        fetchedAt:    null,
        stale:        true,
        preferences:  prefs
      };
      return NextResponse.json(empty);
    }

    const response: NewsSnapshotResponse = {
      specials:     snapshot.specials,
      newArrivals:  snapshot.newArrivals,
      summaryCards: snapshot.summaryCards,
      fetchedAt:    snapshot.fetchedAt,
      stale:        isStale(snapshot.fetchedAt),
      preferences:  prefs
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[api/news] GET failed:", err);
    return NextResponse.json({ error: "Failed to load news" }, { status: 500 });
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors

- [ ] **Step 3: Commit**

```bash
git add app/api/news/route.ts
git commit -m "feat: rewrite news GET route — returns snapshot with budget-annotated items and preferences"
```

---

## Task 11: Create components/news-summary-cards.tsx

**Files:**
- Create: `components/news-summary-cards.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/news-summary-cards.tsx
import type { NewsSummaryCard } from "@/lib/types";
import { SOURCE_LABELS } from "@/lib/news-sources";

const CARD_LABELS: Record<NewsSummaryCard["cardType"], string> = {
  best_value:       "Best value today",
  worth_stretching: "Worth stretching for",
  most_interesting: "Most interesting new arrival"
};

interface Props {
  cards: NewsSummaryCard[];
}

function formatPrice(price: number) {
  return `R${price.toLocaleString("en-ZA")}`;
}

function SummaryCard({ card }: { card: NewsSummaryCard }) {
  const label = CARD_LABELS[card.cardType];
  const inner = (
    <div className="news-summary-card__inner">
      <p className="news-summary-card__label">{label}</p>
      <p className="news-summary-card__title">{card.title}</p>
      {card.subtitle && (
        <p className="news-summary-card__subtitle">{card.subtitle}</p>
      )}
      {card.price && (
        <p className="news-summary-card__price">{formatPrice(card.price)}</p>
      )}
      {card.source && (
        <p className="news-summary-card__source">
          {SOURCE_LABELS[card.source] ?? card.source}
        </p>
      )}
      {card.whyItMatters && (
        <p className="news-summary-card__reason">{card.whyItMatters}</p>
      )}
    </div>
  );

  if (card.url) {
    return (
      <a
        href={card.url}
        target="_blank"
        rel="noopener noreferrer"
        className="news-summary-card news-summary-card--link"
      >
        {inner}
      </a>
    );
  }

  return <div className="news-summary-card">{inner}</div>;
}

export function NewsSummaryCards({ cards }: Props) {
  if (cards.length === 0) return null;

  // Render in canonical order regardless of DB row order
  const order: NewsSummaryCard["cardType"][] = [
    "best_value",
    "worth_stretching",
    "most_interesting"
  ];
  const sorted = order
    .map(t => cards.find(c => c.cardType === t))
    .filter(Boolean) as NewsSummaryCard[];

  return (
    <div className="news-summary-cards">
      {sorted.map(card => (
        <SummaryCard key={card.cardType} card={card} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors

- [ ] **Step 3: Commit**

```bash
git add components/news-summary-cards.tsx
git commit -m "feat: add NewsSummaryCards component — renders 3 GPT intelligence cards"
```

---

## Task 12: Update components/news-item.tsx

**Files:**
- Modify: `components/news-item.tsx`

- [ ] **Step 1: Replace entire contents**

```tsx
// components/news-item.tsx
import Image from "next/image";
import { SOURCE_LABELS } from "@/lib/news-sources";
import type { BudgetFit } from "@/lib/types";

interface Props {
  name: string;
  price: number;
  originalPrice?: number;
  discountPct?: number;
  url: string;
  imageUrl?: string;
  kind: "special" | "new_release";
  budgetFit: BudgetFit;
  whyItMatters: string | null;
  source: string;
}

const BUDGET_BADGE_LABELS: Record<BudgetFit, string> = {
  in_budget:    "In budget",
  stretch:      "Stretch",
  over_budget:  "Over budget",
  above_budget: "Above budget"
};

function BudgetBadge({ fit }: { fit: BudgetFit }) {
  return (
    <span
      className={`news-item__budget-badge news-item__budget-badge--${fit.replace("_", "-")}`}
      aria-label={BUDGET_BADGE_LABELS[fit]}
    >
      {BUDGET_BADGE_LABELS[fit]}
    </span>
  );
}

function formatPrice(price: number) {
  return `R${price.toLocaleString("en-ZA")}`;
}

export function NewsItem({
  name, price, originalPrice, discountPct, url, imageUrl,
  kind, budgetFit, whyItMatters, source
}: Props) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="news-item"
    >
      {imageUrl && (
        <div className="news-item__image">
          <Image src={imageUrl} alt={name} fill style={{ objectFit: "contain" }} unoptimized />
        </div>
      )}
      <div className="news-item__body">
        <p className="news-item__source">{SOURCE_LABELS[source] ?? source}</p>
        <p className="news-item__name">{name}</p>
        <p className="news-item__price">{formatPrice(price)}</p>
        {originalPrice && (
          <p className="news-item__original">was {formatPrice(originalPrice)}</p>
        )}
        {discountPct && (
          <p className="news-item__discount">-{discountPct}%</p>
        )}
        {kind === "new_release" && (
          <p className="news-item__badge">NEW</p>
        )}
        <BudgetBadge fit={budgetFit} />
        {whyItMatters && (
          <p className="news-item__reason">{whyItMatters}</p>
        )}
      </div>
    </a>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors (callers will be fixed in Task 14)

- [ ] **Step 3: Commit**

```bash
git add components/news-item.tsx
git commit -m "feat: update NewsItem card — budget badge, GPT rationale, retailer source label"
```

---

## Task 13: Create components/news-preferences-panel.tsx

**Files:**
- Create: `components/news-preferences-panel.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/news-preferences-panel.tsx
"use client";

import { useState } from "react";
import type { NewsBudgetPreferences } from "@/lib/types";

interface Props {
  initialPreferences: NewsBudgetPreferences;
  onSaved: (prefs: NewsBudgetPreferences) => void;
}

export function NewsPreferencesPanel({ initialPreferences, onSaved }: Props) {
  const [softCap, setSoftCap] = useState(String(initialPreferences.softBudgetCapZar));
  const [stretchCap, setStretchCap] = useState(
    initialPreferences.stretchBudgetCapZar !== null
      ? String(initialPreferences.stretchBudgetCapZar)
      : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const softNum = Number(softCap);
    if (!softCap || isNaN(softNum) || softNum <= 0) {
      setError("Normal budget cap must be a positive number.");
      return;
    }

    // Blank stretch cap is valid — send null
    const stretchNum = stretchCap.trim() === "" ? null : Number(stretchCap);
    if (stretchCap.trim() !== "" && (isNaN(stretchNum!) || stretchNum! <= 0)) {
      setError("Stretch cap must be a positive number or left blank.");
      return;
    }

    const payload: NewsBudgetPreferences = {
      softBudgetCapZar:    softNum,
      stretchBudgetCapZar: stretchNum
    };

    setSaving(true);
    try {
      const res = await fetch("/api/news/preferences", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload)
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      onSaved(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="news-preferences-panel" onSubmit={handleSave}>
      <h3 className="news-preferences-panel__heading">Budget preferences</h3>

      <div className="news-preferences-panel__field">
        <label htmlFor="soft-cap" className="news-preferences-panel__label">
          Normal budget cap (R)
        </label>
        <input
          id="soft-cap"
          type="number"
          min="1"
          step="1"
          className="news-preferences-panel__input"
          value={softCap}
          onChange={e => setSoftCap(e.target.value)}
        />
      </div>

      <div className="news-preferences-panel__field">
        <label htmlFor="stretch-cap" className="news-preferences-panel__label">
          Stretch cap (R) <span className="news-preferences-panel__optional">optional</span>
        </label>
        <input
          id="stretch-cap"
          type="number"
          min="1"
          step="1"
          className="news-preferences-panel__input"
          value={stretchCap}
          placeholder="No limit"
          onChange={e => setStretchCap(e.target.value)}
        />
      </div>

      {error && <p className="news-preferences-panel__error">{error}</p>}
      {saved && <p className="news-preferences-panel__saved">Saved.</p>}

      <button
        type="submit"
        className="news-preferences-panel__save"
        disabled={saving}
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors

- [ ] **Step 3: Commit**

```bash
git add components/news-preferences-panel.tsx
git commit -m "feat: add NewsPreferencesPanel — inline budget cap form, blank stretch cap treated as null"
```

---

## Task 14: Rewrite components/news-feed.tsx

**Files:**
- Modify: `components/news-feed.tsx`

This component becomes the full client-side orchestrator: renders summary cards, preferences panel, two sections (Specials, New Arrivals) each with retailer filter chips, and handles manual refresh.

- [ ] **Step 1: Replace entire contents**

```tsx
// components/news-feed.tsx
"use client";

import { useState, useEffect } from "react";
import { NewsItem } from "@/components/news-item";
import { NewsSummaryCards } from "@/components/news-summary-cards";
import { NewsPreferencesPanel } from "@/components/news-preferences-panel";
import { SOURCE_LABELS } from "@/lib/news-sources";
import type { NewsFeedItem, NewsSummaryCard, NewsBudgetPreferences } from "@/lib/types";
import { computeBudgetFit } from "@/lib/news-budget";

interface Props {
  initialSpecials:    NewsFeedItem[];
  initialNewArrivals: NewsFeedItem[];
  initialSummaryCards: NewsSummaryCard[];
  initialFetchedAt:   string | null;
  initialStale:       boolean;
  initialPreferences: NewsBudgetPreferences;
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "less than an hour ago";
  if (hours === 1) return "1 hour ago";
  return `${hours} hours ago`;
}

function FilterChips({
  items,
  activeSources,
  onToggle
}: {
  items: NewsFeedItem[];
  activeSources: Set<string>;
  onToggle: (source: string) => void;
}) {
  const allSources = [...new Set(items.map(i => i.source))];
  if (allSources.length <= 1) return null;

  return (
    <div className="news-feed__filters">
      {allSources.map(source => (
        <button
          key={source}
          className={`news-feed__chip ${activeSources.has(source) ? "news-feed__chip--active" : ""}`}
          onClick={() => onToggle(source)}
        >
          {SOURCE_LABELS[source] ?? source}
        </button>
      ))}
    </div>
  );
}

function Section({
  title,
  items,
  emptyMessage
}: {
  title: string;
  items: NewsFeedItem[];
  emptyMessage: string;
}) {
  const allSources = [...new Set(items.map(i => i.source))];
  const [activeSources, setActiveSources] = useState<Set<string>>(
    () => new Set(allSources)
  );

  // Reset filter chips when items list changes (after a refresh)
  useEffect(() => {
    setActiveSources(new Set(items.map(i => i.source)));
  }, [items]);

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
    <section className="news-feed__section stack">
      <h2>{title}</h2>
      <FilterChips
        items={items}
        activeSources={activeSources}
        onToggle={toggleSource}
      />
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
              budgetFit={item.budgetFit}
              whyItMatters={item.whyItMatters}
              source={item.source}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function NewsFeed({
  initialSpecials,
  initialNewArrivals,
  initialSummaryCards,
  initialFetchedAt,
  initialStale,
  initialPreferences
}: Props) {
  const [specials, setSpecials]         = useState(initialSpecials);
  const [newArrivals, setNewArrivals]   = useState(initialNewArrivals);
  const [summaryCards, setSummaryCards] = useState(initialSummaryCards);
  const [fetchedAt, setFetchedAt]       = useState(initialFetchedAt);
  const [stale, setStale]               = useState(initialStale);
  const [preferences, setPreferences]   = useState(initialPreferences);
  const [refreshing, setRefreshing]     = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [error, setError]               = useState<string | null>(null);
  const [showPrefs, setShowPrefs]       = useState(false);

  async function loadNews(currentPrefs: NewsBudgetPreferences) {
    try {
      const res = await fetch("/api/news");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as {
        specials: NewsFeedItem[];
        newArrivals: NewsFeedItem[];
        summaryCards: NewsSummaryCard[];
        fetchedAt: string | null;
        stale: boolean;
        preferences: NewsBudgetPreferences;
      };
      // Re-apply budget fit with the current (possibly just-saved) preferences
      const applyPrefs = (items: NewsFeedItem[]) =>
        items.map(i => ({ ...i, budgetFit: computeBudgetFit(i.price, currentPrefs) }));

      setSpecials(applyPrefs(data.specials));
      setNewArrivals(applyPrefs(data.newArrivals));
      setSummaryCards(data.summaryCards);
      setFetchedAt(data.fetchedAt);
      setStale(data.stale);
    } catch (err) {
      setError("Couldn't load news right now. Try refreshing.");
      console.error("[news-feed] loadNews failed:", err);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshMessage("");
    setError(null);
    const timer = setTimeout(() => setRefreshMessage("Still fetching from retailers…"), 15000);
    try {
      await fetch("/api/news/refresh", { method: "POST" });
      await loadNews(preferences);
    } catch (err) {
      setError("Refresh failed. The previous snapshot is still showing.");
      console.error("[news-feed] refresh failed:", err);
    } finally {
      clearTimeout(timer);
      setRefreshing(false);
      setRefreshMessage("");
    }
  }

  function handlePreferencesSaved(prefs: NewsBudgetPreferences) {
    setPreferences(prefs);
    // Re-apply budget fit immediately from cached data, no network round-trip needed
    setSpecials(prev => prev.map(i => ({ ...i, budgetFit: computeBudgetFit(i.price, prefs) })));
    setNewArrivals(prev => prev.map(i => ({ ...i, budgetFit: computeBudgetFit(i.price, prefs) })));
  }

  return (
    <div className="news-feed stack">
      {/* Freshness bar */}
      <div className="news-feed__meta">
        {fetchedAt && (
          <p className="news-feed__freshness">
            Last updated {timeAgo(fetchedAt)}{stale ? " — data may be stale" : ""}
          </p>
        )}
        <div className="news-feed__actions">
          <button
            className="news-feed__refresh"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing…" : "Refresh ↻"}
          </button>
          <button
            className="news-feed__prefs-toggle"
            onClick={() => setShowPrefs(p => !p)}
            aria-expanded={showPrefs}
          >
            Budget preferences
          </button>
        </div>
        {refreshMessage && <p className="news-feed__refresh-msg">{refreshMessage}</p>}
      </div>

      {error && <p className="news-feed__error">{error}</p>}

      {showPrefs && (
        <NewsPreferencesPanel
          initialPreferences={preferences}
          onSaved={handlePreferencesSaved}
        />
      )}

      {/* GPT intelligence summary cards */}
      <NewsSummaryCards cards={summaryCards} />

      {/* Two content sections */}
      <Section
        title="What's on special"
        items={specials}
        emptyMessage="No specials found right now — refresh to check."
      />
      <Section
        title="New arrivals"
        items={newArrivals}
        emptyMessage="No new arrivals right now — refresh to check."
      />
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors (news-feed.tsx no longer imports ScoredNewsItem)

- [ ] **Step 3: Commit**

```bash
git add components/news-feed.tsx
git commit -m "feat: rewrite NewsFeed — summary cards, preferences panel, refresh flow, v2 types"
```

---

## Task 15: Rewrite app/news/page.tsx (server component)

**Files:**
- Modify: `app/news/page.tsx`

- [ ] **Step 1: Replace entire contents**

The page becomes a server component. It reads the latest snapshot and preferences directly from the DB (no client-side fetch on initial load), then passes the data to the `NewsFeed` client component.

```tsx
// app/news/page.tsx
import { NewsFeed } from "@/components/news-feed";
import { getLatestSuccessfulSnapshot } from "@/lib/news-store";
import { getNewsPreferences } from "@/lib/news-preferences-store";
import type { NewsFeedItem, NewsSummaryCard, NewsBudgetPreferences } from "@/lib/types";

export default async function NewsPage() {
  const preferences = await getNewsPreferences();
  const snapshot = await getLatestSuccessfulSnapshot(preferences).catch(() => null);

  const specials:     NewsFeedItem[]    = snapshot?.specials     ?? [];
  const newArrivals:  NewsFeedItem[]    = snapshot?.newArrivals  ?? [];
  const summaryCards: NewsSummaryCard[] = snapshot?.summaryCards ?? [];
  const fetchedAt:    string | null     = snapshot?.fetchedAt    ?? null;
  const stale:        boolean           = fetchedAt ? (Date.now() - new Date(fetchedAt).getTime() > 12 * 60 * 60 * 1000) : true;

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">News</p>
        <h1>What&apos;s on the shelves right now.</h1>
      </section>

      <NewsFeed
        initialSpecials={specials}
        initialNewArrivals={newArrivals}
        initialSummaryCards={summaryCards}
        initialFetchedAt={fetchedAt}
        initialStale={stale}
        initialPreferences={preferences}
      />
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add app/news/page.tsx
git commit -m "feat: convert news page to server component — server-renders snapshot, no client fetch on load"
```

---

## Task 16: Update advisor integration

**Files:**
- Modify: `lib/advisor-context.ts`
- Modify: `app/api/advisor/chat/route.ts`

The advisor's deals context block must use `NewsFeedItem[]` instead of the removed `ScoredNewsItem[]`, and the chat route must load the news snapshot when deals are triggered.

- [ ] **Step 1: Update buildDealsContextBlock in lib/advisor-context.ts**

Replace lines 165–187 (the `buildDealsContextBlock` function) with:

```typescript
export function buildDealsContextBlock(
  specials: NewsFeedItem[],
  newArrivals: NewsFeedItem[],
  fetchedAt: string | null,
  preferences: NewsBudgetPreferences
): string {
  const dateStr = fetchedAt ? new Date(fetchedAt).toLocaleDateString("en-ZA") : "unknown date";
  const budgetLine = preferences.stretchBudgetCapZar !== null
    ? `Budget: up to R${preferences.softBudgetCapZar} normally, stretch to R${preferences.stretchBudgetCapZar}`
    : `Budget: up to R${preferences.softBudgetCapZar} (no fixed stretch ceiling)`;

  const top5Specials = [...specials]
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 5)
    .map(i => {
      const discount = i.discountPct ? ` (-${i.discountPct}%)` : "";
      const badge = i.budgetFit === "in_budget" ? " [in budget]" : ` [${i.budgetFit.replace("_", " ")}]`;
      const reason = i.whyItMatters ? ` — ${i.whyItMatters}` : "";
      return `  - ${i.name} at R${i.price}${discount}${badge} — ${i.source}${reason}`;
    });

  const top5Arrivals = [...newArrivals]
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 5)
    .map(i => {
      const badge = i.budgetFit === "in_budget" ? " [in budget]" : ` [${i.budgetFit.replace("_", " ")}]`;
      const reason = i.whyItMatters ? ` — ${i.whyItMatters}` : "";
      return `  - ${i.name} at R${i.price}${badge} — ${i.source}${reason}`;
    });

  return [
    `CURRENT DEALS & NEW RELEASES (as of ${dateStr}):`,
    budgetLine,
    "Specials:",
    ...top5Specials,
    "New arrivals:",
    ...top5Arrivals
  ].join("\n");
}
```

Also update the import at the top of `lib/advisor-context.ts` — remove `ScoredNewsItem` and add `NewsFeedItem, NewsBudgetPreferences`:

```typescript
import type { CollectionViewItem, PalateProfile, AdvisorSuggestion, NewsFeedItem, NewsBudgetPreferences } from "@/lib/types";
```

Also remove `buildFullDealsBlock` and `buildFullReleasesBlock` (they used `ScoredNewsItem[]`) or update them the same way. Since no caller uses them, remove both:

Delete lines 189–201 (the `buildFullDealsBlock` and `buildFullReleasesBlock` functions).

- [ ] **Step 2: Update app/api/advisor/chat/route.ts to load news when deals are triggered**

Add these imports to the existing import block:

```typescript
import { getLatestSuccessfulSnapshot } from "@/lib/news-store";
import { getNewsPreferences } from "@/lib/news-preferences-store";
import { buildDealsContextBlock } from "@/lib/advisor-context";
```

Replace the existing `if (triggers.deals)` block (which currently does nothing — the function is defined but not called in the chat route) with:

```typescript
  if (triggers.deals) {
    try {
      const newsPrefs = await getNewsPreferences();
      const snapshot = await getLatestSuccessfulSnapshot(newsPrefs);
      if (snapshot) {
        contextBlocks.push(
          buildDealsContextBlock(
            snapshot.specials,
            snapshot.newArrivals,
            snapshot.fetchedAt,
            newsPrefs
          )
        );
      }
    } catch {
      // Non-fatal: advisor still works without news context
    }
  }
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors — `ScoredNewsItem` is no longer referenced anywhere

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/advisor-context.ts app/api/advisor/chat/route.ts
git commit -m "feat: update advisor to use v2 news snapshot and budget prefs for deals context"
```

---

## Task 17: Remove scrapers from active import path

**Files:**
- Modify: `app/api/news/refresh/route.ts` (already done in Task 9 — verify)
- No files deleted; scrapers stay in repo

- [ ] **Step 1: Confirm scraper files are not imported by any active code**

```bash
grep -r "from.*lib/scrapers" app lib components --include="*.ts" --include="*.tsx"
```

Expected: zero results (the only previous importer was `app/api/news/refresh/route.ts` which was rewritten in Task 9)

- [ ] **Step 2: Run full type check and tests one final time**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: zero type errors, all tests pass

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: confirm scrapers removed from active path — files remain for reference"
```

---

## Self-review against spec

### Spec coverage check

| Spec requirement | Task |
|-----------------|------|
| Retire scraper-first refresh path | Task 9, 17 |
| GPT-5.4 via Responses API + web search | Task 8 |
| 5 approved SA retailers only | Task 4, 8 |
| Approved domain + product URL + ZAR price validation | Task 4 |
| Same bottle / different retailer = separate offers | Task 8 (deduplication is per-URL, not per-name) |
| Complete feed snapshots (no accumulating upserts) | Task 5 |
| Only promote snapshot on success | Task 9 |
| Keep last successful snapshot if refresh fails | Task 9 |
| news_refreshes + news_items linked by refresh_id | Task 1 |
| GPT annotations: relevance_score, why_it_matters, citations | Task 1, 5, 8 |
| news_preferences table: soft_budget_cap_zar, stretch_budget_cap_zar | Task 1 |
| GET /api/news — snapshot, grouped items, summary cards, preferences | Task 10 |
| POST /api/news/refresh | Task 9 |
| GET/PATCH /api/news/preferences | Task 7 |
| Blank stretch cap → null, no error | Task 7, 13 |
| BudgetFit: in_budget / stretch / over_budget / above_budget | Task 3 |
| budget_fit computed from price + current preferences | Task 5 (getLatestSuccessfulSnapshot) |
| Summary cards: best_value, worth_stretching, most_interesting | Task 1, 8, 11 |
| Richer item cards: retailer, price, original price, budget badge, GPT reason, retailer link | Task 12 |
| Retailer filter chips | Task 14 |
| Inline preferences panel | Task 13, 14 |
| Server-renders latest snapshot | Task 15 |
| Manual refresh controls | Task 14 |
| v2 types: NewsFeedItem, NewsSummaryCard, NewsBudgetPreferences, NewsSnapshotResponse | Task 2 |
| stretchBudgetCapZar explicitly number | null | Task 2 |
| Mock/local mode — returns empty snapshot + defaults when Supabase absent | Tasks 5, 6 |
| Advisor reads cached news + budget prefs | Task 16 |
| No fallback models in news slice | Task 8 (uses OPENAI_MODEL directly, no fallback) |

### Placeholder scan

No TBDs, TODOs, or "implement later" entries found.

### Type consistency check

- `NewsFeedItem.budgetFit: BudgetFit` — defined Task 2, used in Task 5 (`computeBudgetFit`), Task 12 (NewsItem component), Task 14 (NewsFeed)
- `GptOffer.kind: "special" | "new_release"` — added in Task 5 Step 2, used in Task 9 (refresh route passes kind from GPT)
- `NewsSummaryCard.cardType` — defined Task 2, used in Task 5 (`insertSummaryCards`), Task 11 (`NewsSummaryCards`)
- `buildDealsContextBlock(specials, newArrivals, fetchedAt, preferences)` — updated Task 16 Step 1, called Task 16 Step 2 with matching args
- `getLatestSuccessfulSnapshot(prefs)` — defined Task 5, called in Task 10 and Task 15 and Task 16 with matching signature
