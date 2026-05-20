# WhiskyAdvisor — Knowledge Graph

> Full architecture map: data models, module relationships, API contracts, and data-flow patterns.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15.2.4 (App Router, React 19, TypeScript) |
| Database | Supabase (PostgreSQL) |
| AI / LLM | OpenAI (GPT models, Responses API, web search) |
| Validation | Zod |
| Testing | Vitest |
| Deployment | Vercel |
| HTML scraping | Cheerio |

---

## Directory Map

```
/
├── app/                    # Next.js App Router: pages + API routes
│   ├── page.tsx            # Dashboard
│   ├── layout.tsx          # Root layout + nav
│   ├── collection/         # Browse & bottle detail
│   ├── advisor/            # AI chat + insight cards
│   ├── news/               # Retailer feed
│   ├── compare/            # Side-by-side comparison
│   ├── add/                # Bottle intake (photo / barcode)
│   ├── analytics/          # Collection statistics
│   ├── tastings/           # Tasting sessions hub
│   ├── scan/               # Camera / text quick-scan
│   ├── unlock/             # Access gate
│   └── api/                # REST API routes (see API Routes section)
├── components/             # React UI components (see Components section)
├── lib/                    # Core business logic (see Library Modules section)
├── supabase/               # schema.sql + migrations
├── scripts/                # Maintenance / data-processing scripts
├── tests/                  # Vitest unit + integration tests
└── public/                 # Static assets
```

---

## Database Schema

### Core Tables

**`expressions`** — master whisky records
- `id`, `name`, `distillery_name`, `bottler_name`, `brand`, `country`
- `abv`, `age_statement`, `barcode`, `description`, `image_url`, `tags[]`

**`collection_items`** — user's bottle inventory
- `id`, `expression_id` (FK), `status` (owned | wishlist)
- `fill_state` (sealed | open | finished)
- `purchase_price`, `purchase_currency`, `purchase_date`, `purchase_source`
- `personal_notes`, `rating` (1–3), `is_favorite`, `created_at`, `updated_at`

**`item_images`** — bottle photos
- `id`, `collection_item_id` (FK), `kind` (front | back | detail), `url`, `label`

**`intake_drafts`** — work-in-progress entries
- `id`, `collection_item_id`, `source` (photo | barcode | hybrid | search)
- `barcode`, `raw_ai_response` (JSONB), `expression` (JSONB), `collection` (JSONB)

**`expression_flavor_profiles`** — AI-generated taste scores
- `id`, `expression_id` (FK)
- `pillars` — 8-pillar scores (0–10): smoky, sweet, spicy, fruity, oaky, floral, malty, coastal
- `top_notes[]`, `confidence`, `evidence_count`, `explanation`
- `scoring_version`, `model_version`, `stale_at`

**`news_refreshes`** — retailer scrape jobs
- `id` (UUID), `status` (pending | success | failed), `started_at`, `completed_at`, `error_text`

**`news_items`** — discovered deals
- `id` (UUID), `refresh_id` (FK), `source`, `kind` (special | new_release)
- `name`, `price`, `original_price`, `discount_pct`, `url`, `image_url`, `in_stock`
- `relevance_score`, `why_it_matters`, `citations[]`

**`news_summary_cards`** — curated deal highlights
- `id` (UUID), `refresh_id` (FK)
- `card_type` (best_value | worth_stretching | most_interesting)
- `title`, `subtitle`, `price`, `url`, `why_it_matters`, `source`

**`news_preferences`** — user budget settings
- `soft_budget_cap_zar`, `stretch_budget_cap_zar`, `updated_at`

**`news_seen_state`** — tracks viewed items
- `seen_keys[]` (JSONB)

### Tasting Social Tables

**`tasting_people`** — relationship_type (friend | family | colleague | other), preference_tags  
**`tasting_groups`** — named collections of people  
**`tasting_group_members`** — join: group ↔ person  
**`tasting_places`** — venue/location records  
**`tasting_sessions`** — events with `occasion_type` (visit | whisky_friday | other), `session_date`, `briefing_data` (JSONB)  
**`tasting_session_attendees`** — join: session ↔ person  
**`tasting_session_bottles`** — join: session ↔ collection_item  

---

## Core Domain Types (`lib/types.ts`)

```
Expression              whisky metadata (distillery, bottler, ABV, age, tags, tasting notes)
CollectionItem          user's bottle instance (status, fill state, rating, purchase data)
CollectionViewItem      rich view: item + expression + flavor profile + images
ExpressionFlavorProfile pillar scores (0–10 each), confidence, evidence count
IntakeDraft             incomplete entry with raw AI responses

FlavorPillar enum       smoky | sweet | spicy | fruity | oaky | floral | malty | coastal
CollectionStatus enum   owned | wishlist
FillState enum          sealed | open | finished
IntakeSource enum       photo | barcode | hybrid | search

PalateProfile           cards: peat preference, regional lean, cask styles, flavor tags
AdvisorSuggestion       scored recommendation (0–100 score, rationale, supporting tags)
CollectionAnalytics     aggregated stats: totals, distributions, spend, blind spots

ComparisonColumn        single whisky for comparison
ComparisonRow           attribute row (label, left value, right value)
ComparisonResult        side-by-side result with summary and palate fit

ScanResult              quick-scan output: name, distillery, price, tastingNotes, verdict, rating, palateMatch
ScanCandidate           disambiguation option: name, distillery, hint
TextScanResponse        union: {type:"result",data:ScanResult} | {type:"ambiguous",candidates[]} | {type:"not_found",message}

NewsFeedItem            deal (source, kind, price, relevance_score, budget_fit, why_it_matters)
NewsSummaryCard         curated highlight (best_value | worth_stretching | most_interesting)
NewsAffinity            match scoring (0–100, band, reasons)
BudgetFit enum          in_budget | stretch | over_budget | above_budget

TastingPerson / TastingGroup / TastingPlace / TastingSession
Briefing                tasting order, bottle profiles, tips
TastingSessionView      rich session view with attendees and bottles
BottleSocialSummary     who shared this bottle and where
```

---

## Library Modules (`lib/`)

### `repository.ts` — unified data access layer
All page data flows through this module. Key functions:

| Function | Purpose |
|---|---|
| `getDashboardData()` | collection, analytics, profile, advisor suggestions |
| `getCollectionView()` | all items with profiles + images |
| `getItemById(id)` | rich CollectionViewItem |
| `updateItem(id, payload)` | patch expression / collection fields |
| `deleteItem(id)` | remove from collection |
| `saveDraftAsItem(draftId, payload)` | convert intake draft to saved item |
| `createDraftFromPhoto(file, base64, mime)` | photo intake |
| `createDraftFromBarcode(barcode)` | barcode lookup |
| `getTastingSessions()` / `getTastingSessionView(id)` | tasting data |
| `createTastingSession(payload)` | schedule group tasting |
| `createQuickBottleShare(payload)` | log single bottle share |
| `getPalateProfile()` | user's taste signature |
| `getAdvisorSocialContext()` | people/groups/places |
| `quickAddItem(payload)` | create expression + collection item directly (no draft) — used by scan quick-add |

### `supabase-store.ts` — PostgreSQL adapter
- `readStoreFromSupabase()` — fetch all tables in parallel
- `writeStoreToSupabase()` — upsert all collections
- `isSupabaseStoreEnabled()` — check env config

### `mock-store.ts` — JSON file fallback (dev only)
- `readStore()` / `writeStore()` — load/persist `/data/mock-store.json`
- `seedStore()` — initialize with sample data

### `flavor-profile-repository.ts` — pillar scoring
- `classifyFlavorProfile(expression)` — maps tasting notes → pillar scores via `NOTE_WEIGHTS`
- Applies metadata priors: peat tag, cask style, ABV, age
- Confidence calculated from evidence count
- `markExpressionFlavorProfileStale()` — invalidate for refresh

### `analytics.ts` — collection statistics
`buildCollectionAnalytics(items)` produces:
- Totals (owned, wishlist, by fill state)
- Bottle profile tags (NAS, limited, chill-filtered, natural color)
- Rating distribution, regional split, peat profile
- Top distilleries/bottlers
- Taste identity: pillar averages, top notes
- Collection shape: cask styles, peat distribution
- Spend insight: total ZAR, avg/median prices
- Blind spots: gaps and opportunities

### `advisor.ts` — bottle recommendations
- `buildDrinkNowSuggestions(items, profile)` — top 4 open bottles to taste
- `buildBuyNextSuggestions(items, profile)` — top 4 wishlist picks
- Scoring: region match +10, cask style +10, peat match +10, flavor tags +4 each, open fill state +6

### `advisor-context.ts` — GPT context injection
- `detectContextTriggers(query)` — regex intent detection (drink now, wishlist, analytics, tastings, social, deals)
- `build*Block()` functions — format collection/palate/tasting data as plain text for GPT system prompt

### `profile.ts` — palate profile
- `buildPalateProfile(items)` — Bayesian dampened averaging of rated bottles (BAYES_K = 2)
- Extracts: flavor tags, regions, cask styles, peat preference
- Only rated bottles contribute signal

### `comparison.ts` — side-by-side analysis
- `buildComparison(left, right)` — 14-row matrix
- Rows: Brand, Distillery, Bottler, Age, ABV, Cask, Peat, NAS, Chill-filtered, Natural color, Limited, Tasting notes, Rating
- Generates summary narrative and palate fit recommendations

### `collection-filters.ts` — multi-dimension filtering
- Dimensions: tags, brands, distilleries, bottlers, countries, purchase sources, fill states, ABV/age buckets, price range, ratings, favorites
- `buildSearchHaystack()` — full-text search index
- `filtersFromSearchParams()` — URL state persistence

### `tags.ts` — tag utilities
- Constants: `PEAT_TAGS`, `RECOGNIZED_CASK_STYLE_TAGS`
- Classifiers: `isNas()`, `isChillFiltered()`, `isNaturalColour()`, `isLimited()`, `isIndependentBottler()`
- `formatTagLabel()` — human-readable labels

### News subsystem

| Module | Role |
|---|---|
| `news-store.ts` | Supabase CRUD for news lifecycle (refresh jobs, items, cards) |
| `news-gpt.ts` | GPT-powered retailer discovery + HTML scraping (Cheerio) |
| `news-affinity.ts` | Palate match scoring (0–100) with `FLAVOR_GROUPS` mapping |
| `news-budget.ts` | Price fit categorization against user budget caps |
| `news-browse.ts` | UI filtering and sorting logic |
| `news-preferences-store.ts` | User budget config persistence |
| `news-visit.ts` / `news-visit-store.ts` | Track seen items |

Approved retailer domains: whiskybrother, bottegawhiskey, mothercityliquor, whiskyemporium, normangoodfellows

### OpenAI integration (`openai.ts`)
- `analyzeBottleImage()` — Vision API for photo intake → returns expression JSON
- `quickScanBottle(base64, mime, palate)` — vision + web search in one call → `ScanResult` (used by `/api/scan`)
- `textScanBottle(query, palate)` — two-phase text scan: web-search disambiguation first, then full detail fetch → `TextScanResponse`
- `responsesApi()` — Responses API with `web_search_preview`
- `chatCompletions()` — raw Chat Completions wrapper
- `isReasoningModel()` — o-series detection

### Other key modules

| Module | Role |
|---|---|
| `schemas.ts` | Zod schemas for all API request bodies |
| `item-enrichment.ts` | Web search for missing expression fields |
| `search.ts` | `webSearch(query)` via Responses API |
| `tag-generator.ts` | `TagGenerator` class — infers tags from ExpressionFacts |
| `briefing-formatter.ts` | Markdown for tasting briefings |
| `currency.ts` | ZAR conversion (USD/GBP/EUR rates from env) |
| `auth.ts` | Session mode: owner vs guest |
| `env.ts` | Server env validation with Zod |
| `bottle-detail.ts` | Form field definitions, AI suggestions, citation tracking |
| `bottle-image.ts` | Image URL selection/optimization |
| `upload-image.ts` | Image upload to Supabase storage |
| `utils.ts` | `formatCurrency()`, `formatDate()`, `clamp()`, `average()` |
| `id.ts` | `createId(prefix)` ID generation |

---

## API Routes (`app/api/`)

### Advisor
| Method | Path | Description |
|---|---|---|
| POST | `/api/advisor/chat` | Streaming AI chat with context injection (Vercel AI SDK `streamText`) |
| GET | `/api/advisor/drink-now` | Top open bottles to taste |
| GET | `/api/advisor/buy-next` | Wishlist recommendations |

### Items
| Method | Path | Description |
|---|---|---|
| PATCH | `/api/items/[itemId]` | Update bottle or save draft (`updateItemSchema` / `saveDraftSchema`) |
| DELETE | `/api/items/[itemId]` | Remove from collection |
| GET/POST | `/api/items/[itemId]/flavor-profile` | Get / regenerate pillar scores |
| GET/POST | `/api/items/[itemId]/pricing` | Pricing lookup and refresh |
| POST | `/api/items/[itemId]/enrich` | AI/search field suggestions |
| PATCH | `/api/items/[itemId]/rating` | Rating + favorite flag |
| POST | `/api/items/intake-photo` | Analyze bottle photo → IntakeDraft |
| POST | `/api/items/intake-barcode` | Barcode lookup → IntakeDraft |
| POST | `/api/items/upload-image` | Image upload |

### Scan
| Method | Path | Description |
|---|---|---|
| POST | `/api/scan` | Identify whisky from image (`imageBase64`) or text (`query`); returns `ScanResult`, disambiguation candidates, or not-found |
| POST | `/api/scan/add` | Quick-add identified bottle to collection or wishlist without a draft review step |

### Collection / Comparison / Analytics
| Method | Path | Description |
|---|---|---|
| GET | `/api/collection/search` | Full-text search |
| POST | `/api/compare` | Side-by-side analysis |
| GET | `/api/analytics/collection` | Full analytics payload |

### News
| Method | Path | Description |
|---|---|---|
| GET | `/api/news` | Latest snapshot (budget fit + affinity) |
| POST | `/api/news/refresh` | Trigger retailer scrape |
| GET/PUT | `/api/news/preferences` | Budget settings |
| POST | `/api/news/seen` | Mark items viewed |
| POST | `/api/wishlist/from-news` | Add news item to wishlist |

### Tastings
| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/tastings/sessions` | List / create sessions |
| GET/PATCH/DELETE | `/api/tastings/sessions/[id]` | Session CRUD |
| GET/POST | `/api/tastings/people` | Attendee CRUD |
| GET/PATCH/DELETE | `/api/tastings/people/[id]` | Person CRUD |
| GET/POST | `/api/tastings/groups` | Group CRUD |
| GET/PATCH/DELETE | `/api/tastings/groups/[id]` | Group CRUD |
| GET/POST | `/api/tastings/places` | Venue CRUD |
| GET/PATCH/DELETE | `/api/tastings/places/[id]` | Place CRUD |
| POST | `/api/tastings/briefing` | Generate tasting order + bottle profiles |
| POST | `/api/tastings/advisor` | Recommend guests / bottles for session |

### Auth / Profile
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/unlock` | Cookie-based token validation |
| GET | `/api/profile/palate` | User's taste profile |

---

## Components (`components/`)

### Collection
- `collection-browser.tsx` — browsing UI with filtering, search, view modes (grid / list)
- `collection-card.tsx` — grid card display
- `collection-list-view.tsx` — density list display
- `global-search.tsx` — quick search bar

### Scan
- `whisky-scanner.tsx` — camera capture (getUserMedia, rear-camera preferred) or file upload; calls `/api/scan`; renders result card (price, tasting notes, verdict, palate match) or disambiguation candidate list; quick-add buttons call `/api/scan/add`

### Bottle Management
- `add-bottle-form.tsx` — photo/barcode intake form
- `bottle-record-editor.tsx` — field editing with AI suggestions
- `bottle-rating.tsx` — 3-star + favorite button
- `bottle-chat.tsx` — chat about a specific bottle
- `bottle-sharing-history.tsx` — who tasted this and when

### Advisor
- `advisor-chat.tsx` — streaming chat with web search toggle
- `advisor-card.tsx` — suggestion card (score, rationale, tags)
- `advisor-insights.tsx` — grid of drink-now and buy-next cards

### Tastings
- `tastings-hub.tsx` — main tasting management interface
- `session-briefing.tsx` — tasting order, bottle profiles, tips
- `tasting-chat.tsx` — chat for session context

### News
- `news-feed.tsx` — specials + new arrivals with filters
- `news-item.tsx` — individual deal card
- `news-preferences-panel.tsx` — budget settings
- `news-summary-cards.tsx` — best value / worth stretching highlights

### Comparison
- `compare-form.tsx` — bottle selection
- `flavor-comparison-grid.tsx` — pillar scores side-by-side
- `flavor-bar-grid.tsx` — individual pillar visualization

### Shared
- `profile-card.tsx`, `stat-card.tsx`, `star-rating.tsx`
- `chat-message-content.tsx` — rendered markdown messages
- `multi-select-combobox.tsx` — tag/person selection
- `toast.tsx`, `top-nav.tsx`, `navigation-feedback.tsx`

---

## Data Flow Diagrams

### Bottle Intake

```
User uploads photo / scans barcode
         │
         ▼
POST /api/items/intake-photo  OR  POST /api/items/intake-barcode
         │
         ▼
openai.ts  analyzeBottleImage() or webSearch()
         │
         ▼
IntakeDraft stored in intake_drafts
         │
         ▼
User reviews AI suggestions in bottle-record-editor.tsx
         │
         ▼
PATCH /api/items/[itemId]  (saveDraftSchema)
         │
         ▼
repository.saveDraftAsItem()  →  supabase-store.writeStoreToSupabase()
         │
         ▼
expressions + collection_items rows created
         │
         ▼
POST /api/items/[itemId]/flavor-profile  (auto-triggered)
         │
         ▼
flavor-profile-repository.classifyFlavorProfile()
         │
         ▼
expression_flavor_profiles row saved
```

### Advisor Chat

```
User sends message
         │
         ▼
POST /api/advisor/chat
         │
         ▼
advisor-context.detectContextTriggers(query)
         │
         ├─ drinkNow?  →  buildDrinkNowBlock()
         ├─ wishlist?  →  buildWishlistBlock()
         ├─ analytics? →  buildCollectionSummary()
         ├─ tastings?  →  buildRecentTastingSessionsBlock()
         └─ deals?     →  (news context)
         │
         ▼
Context blocks injected into GPT system prompt
         │
         ▼
streamText() via Vercel AI SDK  →  streaming response to client
         │
         ▼
advisor-chat.tsx renders chunks with react-markdown
```

### News Discovery Loop

```
POST /api/news/refresh
         │
         ▼
news-gpt.discoverNewsWithGpt()
  ├─ fetchRetailerPage()  (Cheerio scraping per approved domain)
  ├─ parseOffers()        (name, price, URL, image)
  ├─ isObviousNonWhiskyOffer() filter
  └─ calculateRelevanceScore() (palate affinity × budget fit)
         │
         ▼
GPT generates why_it_matters + summary cards
         │
         ▼
news-store: insertNewsItems() + insertSummaryCards()
         │
         ▼
GET /api/news
  ├─ news-affinity.computeNewsAffinity()  →  NewsAffinity per item
  └─ news-budget.computeBudgetFit()       →  BudgetFit per item
         │
         ▼
news-feed.tsx renders with filters (budget, palate fit, freshness, retailer)
```

### Quick Scan (Camera / Text)

```
User opens /scan page
         │
         ├─ Camera tab: getUserMedia (rear camera) → capture frame → base64 JPEG
         └─ Text tab:   user types bottle name
         │
         ▼
POST /api/scan  { imageBase64 } or { query }
         │
         ├─ Image path:
         │    openai.quickScanBottle(base64, mime, palate)
         │    └─ responsesApi (vision + web_search_preview) → ScanResult JSON
         │
         └─ Text path (two-phase):
              Phase 1 — openai: responsesApi (disambiguation only, web search)
                └─ ambiguous?  → return candidates immediately
                └─ resolved?   → confirmed expression name
              Phase 2 (if resolved) — openai: responsesApi (full details, web search)
                └─ ScanResult JSON
         │
         ▼
whisky-scanner.tsx renders result card
  name, distillery, price, tasting note pills, verdict, rating, palate match
         │
         ├─ "Add to Collection" / "Add to Wishlist"
         │    POST /api/scan/add  { name, distilleryName, tastingNotes, status }
         │    repository.quickAddItem()  →  expression + collection_item created
         │    redirect to /collection/[itemId]
         │
         └─ "Scan another" → reset camera
```

### Flavor Profile Lifecycle

```
Expression created or tasting notes updated
         │
         ▼
API POST /api/items/[id]/flavor-profile
         │
         ▼
flavor-profile-repository.classifyExpressionFlavorProfileByItemId()
  ├─ Map each tasting note → NOTE_WEIGHTS → pillar deltas
  ├─ Apply metadata priors (peat tag, cask style, ABV, age)
  └─ Normalize to 0–10 per pillar, calculate confidence
         │
         ▼
Saved to expression_flavor_profiles
         │
         ▼
Referenced by: analytics, advisor matching, comparison, news affinity
         │
         ▼
markExpressionFlavorProfileStale()  →  stale_at set  →  regenerated on next request
```

---

## Access Control

Middleware (`middleware.ts`) validates an `APP_ACCESS_TOKEN` cookie.

| Path pattern | Access |
|---|---|
| `/_next`, `/favicon`, `/icon`, `/manifest`, `/bottles`, `/unlock`, `/api/auth/unlock` | Public |
| `/collection`, `/news` | Guest-viewable |
| Everything else | Protected (redirects to `/unlock` if locked) |

`APP_LOCK_ENABLED=true` activates the gate. When disabled, all routes are open.

---

## Environment Variables

```bash
# Client-side (NEXT_PUBLIC_*)
NEXT_PUBLIC_APP_URL               # Base URL
NEXT_PUBLIC_SUPABASE_URL          # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY     # Supabase anon key

# Server-side
SUPABASE_URL                      # (same URL, server-side)
SUPABASE_SERVICE_ROLE_KEY         # Elevated Supabase key
OPENAI_API_KEY                    # GPT access
OPENAI_MODEL                      # e.g. gpt-4-turbo
OPENAI_ENRICHMENT_MODEL           # Optional override for enrichment calls

# Access gate
APP_LOCK_ENABLED                  # "true" | "false"
APP_ACCESS_TOKEN                  # Token value stored in cookie

# Currency conversion
USD_TO_ZAR
GBP_TO_ZAR
EUR_TO_ZAR
```

---

## Test Suite (`tests/`)

| File | Covers |
|---|---|
| `advisor-context.test.ts` | Context trigger detection |
| `analytics.test.ts` | Analytics calculations |
| `auth.test.ts` | Auth / session logic |
| `bottle-detail.test.ts` | Field suggestions |
| `collection-filters.test.ts` | Filter application |
| `flavor-profile-repository.test.ts` | Pillar scoring |
| `logic.test.ts` | Miscellaneous logic |
| `middleware.test.ts` | Access control |
| `news-affinity.test.ts` | Palate matching |
| `news-browse.test.ts` | Filter / sort UI logic |
| `news-budget.test.ts` | Budget categorization |
| `news-gpt-validation.test.ts` | GPT offer parsing |
| `news-preferences-api.test.ts` | Budget API |
| `news-visit.test.ts` | Seen tracking |
| `tag-generator.test.ts` | Tag inference |
| `tastings-api-shape.test.ts` | API response shapes |
| `tastings-repository.test.ts` | Tasting CRUD |
| `tastings-schemas.test.ts` | Schema validation |

Run all tests: `npx vitest run`

---

## Maintenance Scripts (`scripts/`)

| Script | Purpose |
|---|---|
| `cleanup-expressions.mjs` | Remove AI artifacts from drafts |
| `prepare-cleanup-batch.mjs` | Stage cleanup tasks |
| `run-cleanup-batch.mjs` | Execute staged cleanups |
| `apply-cleanup-batch-results.mjs` | Save cleanup results |
| `backfill-ratings.mjs` | Populate missing ratings |
| `reclassify-flavor-profiles.mjs` | Regenerate all pillar scores |
| `migrate-images.mjs` | Transform image URLs |
| `lib/expression-cleanup-shared.mjs` | Shared cleanup utilities |

---

## Key Patterns

**Repository pattern** — all pages and API routes go through `lib/repository.ts`; nothing accesses the store directly.

**Dual-store** — `supabase-store.ts` (production) and `mock-store.ts` (dev JSON fallback) implement the same interface, selected by `isSupabaseStoreEnabled()`.

**Context injection** — the advisor chat builds plain-text context blocks from the user's collection/tastings data and prepends them to the GPT system prompt; this avoids fine-tuning and keeps the model grounded in real data.

**Pillar scoring** — flavor notes map to weighted pillar deltas via `NOTE_WEIGHTS`; metadata priors (peat tag, cask style) nudge scores before normalization. Confidence tracks evidence count for staleness decisions.

**Bayesian palate profile** — only rated bottles contribute; BAYES_K=2 dampens categories with sparse data to avoid over-weighting.

**URL-persisted filter state** — `filtersFromSearchParams()` reads filter state from URL query params, enabling shareable filtered views.
