# WhiskyAdvisor — Claude Code Guide

> For the full architecture map (data models, module relationships, API contracts, data-flow diagrams) see:
> **[docs/knowledge-graph.md](./docs/knowledge-graph.md)**

---

## Project at a Glance

WhiskyAdvisor is a personal whisky collection manager with AI-powered intake, tasting notes, advisor chat, retailer deal discovery, and social tasting sessions.

- **Framework**: Next.js 15 App Router, React 19, TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT (chat, vision, web search via Responses API)
- **Deployment**: Vercel

---

## Where Things Live

| What you want | Where to look |
|---|---|
| Page UI | `app/<feature>/page.tsx` |
| API endpoint | `app/api/<feature>/route.ts` |
| Business logic | `lib/repository.ts` (entry point), then specific module |
| Domain types | `lib/types.ts` |
| Zod schemas (request validation) | `lib/schemas.ts` |
| Database schema | `supabase/schema.sql` |
| UI components | `components/` |
| Tests | `tests/` (Vitest) |
| Maintenance scripts | `scripts/` |

---

## Critical Files

| File | Role |
|---|---|
| `lib/repository.ts` | **Unified data access layer** — all pages/APIs start here |
| `lib/types.ts` | All domain types and enums |
| `lib/schemas.ts` | Zod validation for every API request body |
| `lib/supabase-store.ts` | PostgreSQL read/write adapter |
| `lib/mock-store.ts` | JSON fallback store for local dev |
| `lib/advisor-context.ts` | GPT context injection — intent detection + block builders |
| `lib/flavor-profile-repository.ts` | Pillar scoring (NOTE_WEIGHTS, metadata priors) |
| `lib/analytics.ts` | Collection statistics builder |
| `lib/news-gpt.ts` | Retailer scraping + GPT deal discovery |
| `middleware.ts` | Cookie-based access control |
| `.env.example` | All required environment variables |

---

## Key Conventions

- **All data access goes through `lib/repository.ts`** — never call the store directly from a page or API route.
- **Dual store**: `isSupabaseStoreEnabled()` selects Supabase (prod) or mock JSON (dev). Both implement the same interface.
- **Flavor profiles** are scored from tasting notes via `NOTE_WEIGHTS` + metadata priors, then stored in `expression_flavor_profiles`. Mark stale to trigger regeneration.
- **Advisor chat** uses context injection: `detectContextTriggers()` picks relevant `build*Block()` functions and prepends plain-text context to the GPT system prompt.
- **Palate profile** only uses rated bottles; Bayesian dampening (BAYES_K=2) prevents sparse categories from dominating.
- **Filter state** is persisted in URL query params via `filtersFromSearchParams()`.
- **Currency** is always stored in ZAR; conversion rates come from env vars.
- **Ratings**: 1–3 stars; only 3-star bottles can be marked as favorites (enforced in `ratingSchema`).

---

## Keeping the Knowledge Graph Up to Date

**Whenever you make a structural change, update `docs/knowledge-graph.md` as part of the same commit.** Structural changes include:

- Adding or modifying a database table (`supabase/schema.sql`)
- Adding or renaming a `lib/` module or its exported functions
- Adding or changing an API route
- Adding a new domain type or enum in `lib/types.ts`
- Adding a new Zod schema in `lib/schemas.ts`
- Adding or removing a significant component
- Changing a core architectural pattern or data-flow

Minor changes (bug fixes, style tweaks, copy changes) do not require a knowledge graph update.

---

## Running Locally

```bash
npm install
cp .env.example .env.local   # fill in keys
npm run dev
```

Tests:
```bash
npx vitest run
```

---

## Environment Variables

See `.env.example` for the full list. Key groups:

- `NEXT_PUBLIC_SUPABASE_*` — client-side Supabase
- `SUPABASE_*` — server-side Supabase (service role key)
- `OPENAI_API_KEY` / `OPENAI_MODEL` — GPT access
- `APP_LOCK_ENABLED` / `APP_ACCESS_TOKEN` — optional access gate
- `USD_TO_ZAR`, `GBP_TO_ZAR`, `EUR_TO_ZAR` — currency conversion
