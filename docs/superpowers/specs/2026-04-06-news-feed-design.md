# News Feed (Specials & New Releases) — Design Spec

**Date:** 2026-04-06
**Status:** Approved

---

## Overview

A dedicated news page that surfaces current whisky specials and new releases from South African retailers. Results are scraped daily, cached in Supabase, and scored against the user's palate profile. The advisor can reference this data when answering deal and purchase questions.

---

## Goals

- Show current specials (price drops, promotions) and new arrivals from SA retailers
- Score each item against the user's palate profile using existing advisor scoring logic
- Cache results in Supabase with a 12-hour TTL; manual refresh always available
- Feed deal summaries into the conversational advisor context

---

## Architecture

### Files

| File | Role |
|---|---|
| `app/news/page.tsx` | News page — two sections: specials + new releases |
| `components/news-feed.tsx` | Feed section component (shared by both sections) |
| `components/news-item.tsx` | Individual deal/release card with palate-match stars |
| `app/api/news/route.ts` | Returns cached results from Supabase |
| `app/api/news/refresh/route.ts` | Triggers all scrapers, upserts results, called by cron + manual UI |
| `lib/scrapers/index.ts` | Orchestrates all scrapers, collects results, handles failures |
| `lib/scrapers/whiskybrother.ts` | Scraper for whiskybrother.com |
| `lib/scrapers/bottegawhiskey.ts` | Scraper for bottegawhiskey.com |
| `lib/scrapers/mothercityliquor.ts` | Scraper for mothercityliquor.co.za |
| `lib/scrapers/whiskyemporium.ts` | Scraper for whiskyemporium.co.za |
| `lib/scrapers/normangoodfellows.ts` | Scraper for www.ngf.co.za |
| `lib/advisor-context.ts` | Extended to include deal summary in always-on context |

### Data Flow

1. Vercel cron hits `/api/news/refresh` daily at 07:00 SAST (or user clicks Refresh)
2. Orchestrator runs all scrapers in parallel, collects `NewsItem[]` from each
3. Failed scrapers return `[]` and log the error — others continue unaffected
4. Results upserted into Supabase `news_items` table by `(source, url)`
5. News page reads from DB — fast, no scraping on page load
6. Each item scored against palate profile at read time using existing `scoreMatch` logic
7. Advisor context assembly pulls top 5 specials + top 5 releases (by palate score) into always-on context

---

## Data Schema

### `news_items` Supabase table

```sql
id             uuid primary key
source         text          -- 'whiskybrother', 'normangoodfellows', etc.
kind           text          -- 'special' | 'new_release'
name           text          -- bottle name as listed on the site
price          numeric       -- current price in ZAR
original_price numeric       -- pre-discount price (null if not a special)
discount_pct   integer       -- calculated discount % (null if not a special)
url            text          -- direct link to product page
image_url      text          -- product image if available
in_stock       boolean       -- whether listed as available
fetched_at     timestamptz   -- when this record was last scraped
```

### Scraper Output Interface

Every scraper returns the same shape:

```ts
interface NewsItem {
  source: string
  kind: 'special' | 'new_release'
  name: string
  price: number
  originalPrice?: number
  discountPct?: number
  url: string
  imageUrl?: string
  inStock: boolean
}
```

### Staleness

Items older than 12 hours are considered stale. The page shows "Last updated X hours ago" and a refresh button.

---

## Scraper Design

Each scraper is a single async function using `fetch` + `cheerio`:

```ts
export async function scrapeWhiskyBrother(): Promise<NewsItem[]> {
  const html = await fetch('https://whiskybrother.com/specials').then(r => r.text())
  const $ = cheerio.load(html)
  // site-specific selectors
  return items
}
```

### Per-Site Strategy

| Site | Domain | Approach |
|---|---|---|
| Whisky Brother | whiskybrother.com | Specials category + new arrivals page |
| Bottega Whiskey | bottegawhiskey.com | Sale/specials collection + new in |
| Mother City Liquor | mothercityliquor.co.za | Promotions page + new products |
| Whisky Emporium | whiskyemporium.co.za | Specials + new arrivals |
| Norman Goodfellows | www.ngf.co.za | Promotions + new in category |

### Resilience

- Each scraper wrapped in try/catch — failure returns `[]`, logs error
- Orchestrator collects from all scrapers regardless of individual failures
- If all scrapers fail, page shows "Couldn't reach any retailers right now"
- Upsert by `(source, url)` prevents duplicates on re-run

---

## News Page UI

### Layout

```
┌─────────────────────────────────────┐
│  News                               │
│  "What's on the shelves right now." │
│                          [Refresh ↻]│
│  Last updated 3 hours ago           │
├─────────────────────────────────────┤
│  [Source filter chips]              │
│                                     │
│  What's on special                  │
│  ┌─────────┐ ┌─────────┐ ┌────────┐│
│  │ Bottle  │ │ Bottle  │ │Bottle  ││
│  │ R1,299  │ │ R2,100  │ │R899    ││
│  │ was R1,6│ │ was R2,4│ │was R1,1││
│  │ -19%    │ │ -13%    │ │-18%    ││
│  │ ★★★     │ │         │ │★★      ││
│  └─────────┘ └─────────┘ └────────┘│
├─────────────────────────────────────┤
│  New arrivals                       │
│  ┌─────────┐ ┌─────────┐ ┌────────┐│
│  │ Bottle  │ │ Bottle  │ │Bottle  ││
│  │ R3,499  │ │ R1,850  │ │R4,200  ││
│  │ NEW     │ │ NEW     │ │NEW     ││
│  │ ★★★     │ │         │ │★       ││
│  └─────────┘ └─────────┘ └────────┘│
└─────────────────────────────────────┘
```

### Palate Match Stars

Derived from `scoreMatch` at read time. Not stored in DB.

| Stars | Score range | Meaning |
|---|---|---|
| (none) | < 60 | Weak or no match |
| ★ | 60–70 | Some match |
| ★★ | 71–85 | Good match |
| ★★★ | 86+ | Strong match |

### Interactions

- Tapping a card opens the retailer product page in a new tab
- Refresh button calls `/api/news/refresh`, shows spinner, reloads on completion
- If refresh takes >10s, shows "still fetching..." message
- Source filter chips toggle individual retailers on/off per section

### Empty & Error States

- No specials: "No specials found right now — check back later."
- No new releases: "No new arrivals right now — check back later."
- All scrapers failed: "Couldn't reach any retailers right now."
- Individual scraper errors swallowed silently

---

## Advisor Integration

### Always-On Context (~200 tokens added to every message)

```
CURRENT DEALS & NEW RELEASES (as of [date]):
Specials: [top 5 by palate score] — name, price, discount, source
New arrivals: [top 5 by palate score] — name, price, source
```

### Conditional Full Feed

| Trigger keywords | Extra context injected |
|---|---|
| "special", "deal", "discount", "on sale" | All current specials with prices + palate scores |
| "new", "just arrived", "new release", "what's new" | All current new releases |
| "buy", "should I get", "worth it", "purchase" | Both specials and new releases |

### Advisor Behaviour

- *"What's a good buy right now?"* → full feed, recommends by palate match + price
- *"Is there anything on special that suits me?"* → filters specials by palate score, opinionated answer
- *"Anything new worth trying?"* → surfaces high-match new arrivals with genuine opinion
- If data is stale: *"My deals info is from yesterday — you might want to hit refresh on the news page."*

**The advisor never scrapes directly.** It always reads from the Supabase cache.

---

## Out of Scope (V1)

- Price history / tracking price drops over time
- Email or push notifications for deals
- Searching or filtering by price range, region, distillery
- Scraping international retailers
- Automatic detection of which bottles match items already in the collection
