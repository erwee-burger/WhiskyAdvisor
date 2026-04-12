# Whisky Advisor

Single-user web app for managing a personal whisky collection with AI-assisted recommendations, tasting notes, and curated news.

## Tech Stack

- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript 5.8
- **AI:** Vercel AI SDK + OpenAI (GPT-5.4, gpt-4o-search-preview)
- **Database:** Supabase PostgreSQL (falls back to local JSON in dev)
- **Styling:** Plain CSS with custom properties (dark whisky theme, no CSS-in-JS)
- **Validation:** Zod at API boundaries
- **Testing:** Vitest
- **Package manager:** npm

## Architecture

Hybrid SSR + API routes. Server Components fetch data; Client Components handle interactivity. No global state library — React hooks + Vercel AI SDK `useChat()`.

### Key flow

1. **Middleware** (`middleware.ts`) — enforces optional token-based app lock
2. **Server Components** — fetch via repository layer, render pages
3. **Client Components** — forms, chat, filtering
4. **API Routes** (`app/api/`) — REST endpoints + streaming for advisor chat
5. **Repository** (`lib/repository.ts`) — central data access, delegates to store
6. **Store layer** — `supabase-store.ts` (prod) or `mock-store.ts` (dev), auto-selected by env

### Data flow: adding a bottle

```
Photo → POST /api/items/intake-photo → OpenAI vision → IntakeDraft
     → User edits draft → image uploaded to Supabase Storage
     → PATCH /api/items/{draftId} → saveDraftAsItem() → Expression + CollectionItem created
     → Redirect to /collection/{itemId}
```

### Data flow: advisor chat

```
User message → POST /api/advisor/chat
            → detectContextTriggers() builds dynamic system prompt
            → streamText() with optional web search tool
            → Streaming response → extractSuggestions() for follow-up chips
```

## Key Directories

```
app/
  api/
    advisor/        Chat, drink-now, buy-next endpoints
    items/          CRUD, intake-photo, intake-barcode, upload-image, rating
    analytics/      Collection stats
    compare/        Side-by-side comparison
    export/         CSV/JSON export
    news/           Scrape + preferences
    auth/           Token-based unlock
  collection/       Browse + detail pages
  add/              Photo-first add bottle flow
  advisor/          Chat + insights page
  analytics/        Dashboard
  compare/          Comparison tool
  news/             Curated deals & releases

lib/
  repository.ts     Central data access (all reads/writes)
  supabase-store.ts Supabase adapter
  mock-store.ts     Local JSON dev fallback (with legacy migration logic)
  types.ts          Core types (Expression, CollectionItem, IntakeDraft, etc.)
  schemas.ts        Zod validation schemas
  env.ts            Environment config + production assertion
  openai.ts         OpenAI calls (Responses API + Chat Completions fallback)
  advisor-context.ts  Dynamic system prompt builder (intent detection → context blocks)
  advisor.ts        Scoring logic for drink-now / buy-next
  profile.ts        Palate profile inference from ratings
  news-*.ts         News scraping, GPT analysis, budget ranking, storage

components/
  add-bottle-form.tsx       Photo intake → draft → review → save
  advisor-chat.tsx          Streaming chat with suggestion chips
  collection-browser.tsx    Grid/list with filtering
  bottle-record-editor.tsx  Metadata editing form
  bottle-rating.tsx         1-3 star rating + favorite toggle
  news-feed.tsx             News items + summary cards

supabase/migrations/        SQL migration files (chronological)
tests/                      Vitest test files
data/mock-store.json        Dev data store
```

## Critical Files

| File | Role |
|------|------|
| `middleware.ts` | App lock enforcement — redirects to /unlock if not authenticated |
| `lib/repository.ts` | All data mutations and queries (~1000 lines, the heart of the backend) |
| `lib/types.ts` | Master type definitions |
| `lib/schemas.ts` | Zod schemas — validation at every API boundary |
| `lib/env.ts` | Env validation; `assertProductionEnv()` called from root layout |
| `lib/openai.ts` | Dual-mode: Responses API first, Chat Completions fallback |
| `lib/advisor-context.ts` | Builds system prompts by detecting query intent via regex |
| `app/globals.css` | All styles — CSS custom properties, dark theme |
| `components/add-bottle-form.tsx` | Most complex client component (multi-step intake flow) |

## Database Schema (Supabase)

```
expressions          — Bottle identity (name, distillery, bottler, ABV, age, tags[])
collection_items     — Ownership (status, fill_state, purchase info, rating, is_favorite)
item_images          — Photos (kind: front|back|detail, url)
intake_drafts        — Transient AI analysis results before promotion to items
news_items           — Scraped deals/releases with relevance scores
news_refreshes       — Scrape run metadata
news_summary_cards   — "Best value" / "Worth stretching" cards
user_news_preferences — Budget caps (soft + stretch in ZAR)
```

## API Endpoints

```
POST   /api/items/intake-photo       Analyze bottle photo (OpenAI vision)
POST   /api/items/intake-barcode     Barcode lookup
POST   /api/items/upload-image       Upload to Supabase Storage
PATCH  /api/items/{itemId}           Create from draft or update
DELETE /api/items/{itemId}           Delete bottle
PUT    /api/items/{itemId}/rating    Set rating (1-3) & favorite

POST   /api/advisor/chat?search=0|1  Stream advisor response
GET    /api/advisor/drink-now        Scored open-now suggestions
GET    /api/advisor/buy-next         Wishlist recommendations

GET    /api/analytics/collection     Collection stats
POST   /api/compare                  Compare two bottles
GET    /api/export?format=csv|json   Export collection

POST   /api/news/refresh             Trigger news scrape
POST   /api/news/preferences         Update budget prefs
GET    /api/news                     Latest news snapshot

POST   /api/auth/unlock              Token-based app unlock
```

## Conventions

- **Files:** kebab-case (`add-bottle-form.tsx`, `advisor-context.ts`)
- **Types:** PascalCase (`CollectionItem`, `PalateProfile`)
- **Variables:** camelCase; constants UPPER_SNAKE (`STALE_MS`, `DEFAULT_CHIPS`)
- **DB columns:** snake_case (`distillery_name`, `created_at`)
- **Components:** Server by default; `"use client"` only where needed
- **Error handling:** try/catch in API routes → `{ error: "message" }` with status code
- **Validation:** Zod parse at API entry, not deep in business logic

## Gotchas

- **Dual OpenAI mode** — `analyzeBottleImage()` tries Responses API (GPT-5.4 + web search), falls back to Chat Completions (gpt-4o-search-preview). Same pattern in `webSearch()`.
- **Store auto-switch** — `readStore()`/`writeStore()` check `isSupabaseStoreEnabled()` at runtime. Missing Supabase env vars = JSON file mode silently.
- **Draft promotion isn't atomic** — `saveDraftAsItem()` creates the item first, then cleans up the draft. If cleanup fails, bottle is saved but draft lingers.
- **Tags replaced structured columns** — Single `tags: string[]` on expressions replaces old `whisky_type`, `peat_level`, `cask_influence`. Normalized via SQL migration.
- **Rating + favorite constraint** — Only 3-star bottles can be `isFavorite: true`. Enforced by Zod schema refine.
- **Advisor context is selective** — `detectContextTriggers()` uses regex to decide which context blocks to include in system prompt. Not all collection data is sent every time.
- **Image resize on client** — Canvas resize to max 1200px / quality 0.82 before upload. Data URL → Supabase Storage.
- **News staleness** — 12-hour TTL (`STALE_MS`). UI shows stale indicator; manual refresh triggers re-scrape.
- **Mock store has legacy migrations** — `mock-store.ts` auto-converts old schemas (distillery/bottler refs → flat names) on first read.
- **Middleware public paths** — `/bottles` path is public (allows shareable bottle links even with app lock enabled).

## Development

```bash
npm install
npm run dev
```

Without Supabase env vars, the app runs in local mock mode (`data/mock-store.json`).

## Production Setup

Required environment variables:

```
NEXT_PUBLIC_APP_URL         Public app domain
SUPABASE_URL                PostgreSQL backend
SUPABASE_SERVICE_ROLE_KEY   Admin access token
SUPABASE_ANON_KEY           Public anon key
OPENAI_API_KEY              OpenAI API key
OPENAI_MODEL                Model name (default: gpt-5.4)
APP_LOCK_ENABLED=true       Enable token-based access control
APP_ACCESS_TOKEN            Secret token for /unlock
```

Optional currency conversion rates: `USD_TO_ZAR`, `GBP_TO_ZAR`, `EUR_TO_ZAR`

In production, the app performs strict env validation at startup. With `APP_LOCK_ENABLED=true`, all pages and API routes require authentication via the unlock flow.

Deployment checklist: [GO_LIVE_CHECKLIST.md](./docs/GO_LIVE_CHECKLIST.md)
