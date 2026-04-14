# News V2 — Retailer Intelligence Improvements

**Date:** 2026-04-12
**Status:** Ready to implement
**Scope:** lib/news-gpt.ts rewrite + minor refresh route update + test updates

---

## Problems Being Solved

### 1. Incomplete coverage
A single prompt asking GPT to search 5 sites simultaneously results in inconsistent coverage — some retailers get thorough results, others get skipped. Whisky Brother has visible new arrivals on their site but none appear in the feed.

### 2. Budget filtering suppresses items
The prompt prominently shows the user's budget cap, and GPT self-censors results — returning fewer above-budget items. The requirement is: **include ALL items regardless of price, flag them with a budget tier, never omit based on price.**

### 3. Vague new arrivals definition
"Find NEW ARRIVALS" gives GPT no guidance on where to look. Each retailer has different naming: "New In", "New Arrivals", "Just Landed", etc.

### 4. Silent validation failures
Items GPT returns get silently dropped when validation fails with only scattered `console.warn` calls — invisible in production Vercel logs.

---

## Architecture Change: Per-Retailer Parallel Searches

Switch from **one multi-retailer prompt** to **5 parallel GPT calls** (one per retailer) + **1 summary card call** after combining results.

```
Before: 1 call → all 5 retailers + summary cards

After:  5 parallel calls → one retailer each (no budget, no summary cards)
                        ↓ combine all results
        1 call → summary cards (with budget context, from full offer list)
```

**Benefits:**
- Each retailer gets dedicated search budget
- Budget removed from discovery — GPT cannot self-censor based on price
- Retailer-specific hints guide GPT to the right sections
- One retailer failing does not abort others (non-fatal failures)

---

## Files Affected

| File | Action |
|------|--------|
| `lib/news-gpt.ts` | Major rewrite |
| `app/api/news/refresh/route.ts` | Minor — zero-count warning |
| `tests/news-gpt-validation.test.ts` | Update for new signatures |

---

## Task 1: Add `RETAILER_HINTS` map

Add to `lib/news-gpt.ts` (module level, near `APPROVED_SOURCE_DOMAINS`):

```typescript
const RETAILER_HINTS: Record<string, { specials: string; newArrivals: string }> = {
  whiskybrother:    {
    specials:    "Look for sale, discounted, or on-special whisky items",
    newArrivals: "Look for a 'New In' or 'New Arrivals' section listing recently added products"
  },
  bottegawhiskey:   {
    specials:    "Look for discounted or on-special whisky items",
    newArrivals: "Look for recently added or newly listed products"
  },
  mothercityliquor: {
    specials:    "Look for a specials or deals section",
    newArrivals: "Look for new products or recently added stock"
  },
  whiskyemporium:   {
    specials:    "Look for specials, sales, or discounted whiskies",
    newArrivals: "Look for a new arrivals section or recently added stock"
  },
  normangoodfellows:{
    specials:    "Look for sale items or whiskies on special at ngf.co.za",
    newArrivals: "Look for new arrivals or newly listed whiskies at ngf.co.za"
  }
};
```

---

## Task 2: Add `buildRetailerPrompt(source)` function

New function in `lib/news-gpt.ts`. Takes a single source key, returns a focused single-retailer prompt:

```typescript
function buildRetailerPrompt(source: string): string {
  const domain = APPROVED_SOURCE_DOMAINS[source];
  const hints = RETAILER_HINTS[source];

  return [
    `You are a whisky retail intelligence agent. Search the live website: ${domain}`,
    ``,
    `Find ALL current SPECIALS (discounted whiskies) and ALL NEW ARRIVALS at this retailer.`,
    ``,
    `SPECIALS: ${hints.specials}`,
    `NEW ARRIVALS: ${hints.newArrivals}`,
    ``,
    `IMPORTANT RULES:`,
    `- Include ALL items you find regardless of price — do not filter by price`,
    `- Only include items from ${domain} — no other retailers`,
    `- Every item must have a direct product page URL on ${domain}`,
    `- Use source key: "${source}" for every item`,
    `- If you find no specials, return specials: []`,
    `- If you find no new arrivals, return newArrivals: []`,
    `- Do not invent items — only include things you can verify are currently listed`,
    ``,
    `Score each item: relevanceScore 0–100 based on whisky quality and general interest only.`,
    `Write a whyItMatters sentence (1–2 sentences) about what makes this bottle notable.`,
    ``,
    `Return ONLY a single valid JSON object with no markdown, no explanation.`,
    `Required shape:`,
    JSON.stringify({
      specials: [
        {
          source,
          kind: "special",
          name: "Example 12 Year",
          price: 799,
          originalPrice: 950,
          discountPct: 16,
          url: `https://${domain}/products/example-12`,
          imageUrl: null,
          inStock: true,
          relevanceScore: 75,
          whyItMatters: "Solid sherry cask expression at a good discount.",
          citations: [`https://${domain}/products/example-12`]
        }
      ],
      newArrivals: [
        {
          source,
          kind: "new_release",
          name: "New Release Name",
          price: 1200,
          url: `https://${domain}/products/new-release`,
          imageUrl: null,
          inStock: true,
          relevanceScore: 68,
          whyItMatters: "First time this expression has appeared at this retailer.",
          citations: [`https://${domain}/products/new-release`]
        }
      ]
    }, null, 2)
  ].join("\n");
}
```

---

## Task 3: Add `buildSummaryCardsPrompt(offers, profile, prefs)` function

Used for the final summary cards call — reasoning only from the combined offer list:

```typescript
function buildSummaryCardsPrompt(
  offers: GptOffer[],
  profile: PalateProfile | null,
  prefs: NewsBudgetPreferences
): string {
  const offerLines = offers.map(o =>
    `- [${o.source}] ${o.name} — R${o.price} (${o.kind})`
  ).join("\n");

  const budgetLines = [
    `Normal budget cap: R${prefs.softBudgetCapZar}`,
    prefs.stretchBudgetCapZar !== null
      ? `Stretch ceiling: R${prefs.stretchBudgetCapZar}`
      : "No fixed stretch ceiling"
  ];

  const palateLines = profile
    ? [
        profile.favoredRegions.length ? `Preferred regions: ${profile.favoredRegions.join(", ")}` : null,
        profile.favoredCaskStyles.length ? `Favoured cask styles: ${profile.favoredCaskStyles.join(", ")}` : null,
        profile.favoredPeatTag ? `Peat preference: ${profile.favoredPeatTag}` : null,
        profile.favoredFlavorTags.length ? `Top flavour tags: ${profile.favoredFlavorTags.join(", ")}` : null
      ].filter(Boolean)
    : ["No palate profile — pick on general quality and value"];

  return [
    "You are a whisky advisor. From the list of current offers below, pick three summary cards.",
    "",
    "AVAILABLE OFFERS:",
    offerLines,
    "",
    "USER BUDGET:",
    ...budgetLines,
    "",
    "USER PALATE:",
    ...palateLines,
    "",
    "Pick exactly three cards:",
    "  bestValue       — best price-to-quality bottle within the normal budget cap",
    "  worthStretching — one bottle worth exceeding the normal budget cap for (must be genuinely exceptional)",
    "  mostInteresting — most unusual or noteworthy item regardless of budget",
    "",
    "Each card must reference a real item from the list above.",
    "Return ONLY valid JSON with no markdown:",
    JSON.stringify({
      summaryCards: {
        bestValue:       { title: "Example 12 Year", subtitle: "16% off at Whisky Brother", price: 799, url: "https://whiskybrother.com/products/example-12", whyItMatters: "Best r/quality this week.", source: "whiskybrother" },
        worthStretching: { title: "Premium Expression", subtitle: "Limited release", price: 2200, url: "https://...", whyItMatters: "Rare cask.", source: "whiskyemporium" },
        mostInteresting: { title: "New Distillery Release", subtitle: "New arrival", price: 1200, url: "https://...", whyItMatters: "First SA release.", source: "whiskyemporium" }
      }
    }, null, 2)
  ].join("\n");
}
```

---

## Task 4: Add `discoverRetailerOffers` private helper

```typescript
async function discoverRetailerOffers(
  source: string,
  apiKey: string,
  model: string
): Promise<{ specials: unknown[]; newArrivals: unknown[] }> {
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        tools: [{ type: "web_search_preview" }],
        input: [{ role: "user", content: [{ type: "input_text", text: buildRetailerPrompt(source) }] }]
      })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.warn(`[news-gpt] ${source}: Responses API ${response.status} — skipping. ${body}`);
      return { specials: [], newArrivals: [] };
    }

    const payload = await response.json();
    const text = getResponsesText(payload);
    const raw = extractJson<Record<string, unknown>>(text);

    if (!raw) {
      console.warn(`[news-gpt] ${source}: no parseable JSON in response — skipping`);
      return { specials: [], newArrivals: [] };
    }

    return {
      specials:    Array.isArray(raw.specials)    ? raw.specials    : [],
      newArrivals: Array.isArray(raw.newArrivals) ? raw.newArrivals : []
    };
  } catch (err) {
    console.warn(`[news-gpt] ${source}: ${err instanceof Error ? err.message : String(err)} — skipping`);
    return { specials: [], newArrivals: [] };
  }
}
```

**Key: non-fatal.** Any retailer that fails returns empty arrays; the other 4 still run.

---

## Task 5: Add `generateSummaryCards` private helper

Uses Chat Completions (reasoning only — no web search needed):

```typescript
async function generateSummaryCards(
  offers: GptOffer[],
  profile: PalateProfile | null,
  prefs: NewsBudgetPreferences,
  apiKey: string,
  model: string
): Promise<GptNewsResponse["summaryCards"]> {
  if (offers.length === 0) return {};

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: buildSummaryCardsPrompt(offers, profile, prefs) }]
      })
    });

    if (!response.ok) return {};

    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = payload.choices?.[0]?.message?.content ?? "";
    const raw = extractJson<Record<string, unknown>>(text);

    if (!raw?.summaryCards || typeof raw.summaryCards !== "object") return {};

    const cards = raw.summaryCards as Record<string, unknown>;
    return {
      bestValue:       extractCard(cards.bestValue),
      worthStretching: extractCard(cards.worthStretching),
      mostInteresting: extractCard(cards.mostInteresting)
    };
  } catch {
    return {};
  }
}
```

---

## Task 6: Extract `validateAndDedupe` helper + improve rejection logging

Extract validation + deduplication from `validateGptNewsResponse` into a new helper:

```typescript
function validateAndDedupe(
  rawSpecials: unknown[],
  rawNewArrivals: unknown[]
): { specials: GptOffer[]; newArrivals: GptOffer[]; rejectionCount: number } {
  const rejections: string[] = [];

  const validatedSpecials: GptOffer[] = [];
  for (const offer of rawSpecials) {
    try {
      validatedSpecials.push(validateGptOffer({ ...(offer as object), kind: "special" }));
    } catch (e) {
      rejections.push(`special: ${(e as Error).message}`);
    }
  }

  const validatedNewArrivals: GptOffer[] = [];
  for (const offer of rawNewArrivals) {
    try {
      validatedNewArrivals.push(validateGptOffer({ ...(offer as object), kind: "new_release" }));
    } catch (e) {
      rejections.push(`new_release: ${(e as Error).message}`);
    }
  }

  if (rejections.length > 0) {
    console.warn("[news-gpt] validation rejections:", rejections.join(" | "));
  }

  const seen = new Set<string>();
  const deduped = (arr: GptOffer[]) => arr.filter(o => {
    if (seen.has(o.url)) return false;
    seen.add(o.url);
    return true;
  });

  return {
    specials:       deduped(validatedSpecials),
    newArrivals:    deduped(validatedNewArrivals),
    rejectionCount: rejections.length
  };
}
```

---

## Task 7: Rewrite `discoverNewsWithGpt`

Replace the current single-call implementation:

```typescript
export async function discoverNewsWithGpt(
  profile: PalateProfile | null,
  prefs: NewsBudgetPreferences
): Promise<GptNewsResponse> {
  const { OPENAI_API_KEY, OPENAI_MODEL } = getServerEnv();

  // Step 1: 5 parallel per-retailer calls
  const retailerResults = await Promise.all(
    APPROVED_SOURCE_KEYS.map(source => discoverRetailerOffers(source, OPENAI_API_KEY, OPENAI_MODEL))
  );

  // Step 2: Combine raw results
  const allRawSpecials: unknown[] = [];
  const allRawNewArrivals: unknown[] = [];
  for (const result of retailerResults) {
    allRawSpecials.push(...result.specials);
    allRawNewArrivals.push(...result.newArrivals);
  }

  // Step 3: Validate and deduplicate
  const { specials, newArrivals, rejectionCount } = validateAndDedupe(allRawSpecials, allRawNewArrivals);

  if (rejectionCount > 0) {
    console.warn(`[news-gpt] ${rejectionCount} offers rejected during validation`);
  }
  console.log(`[news-gpt] discovered: ${specials.length} specials, ${newArrivals.length} new arrivals`);

  // Step 4: Generate summary cards from the full combined offer list
  const summaryCards = await generateSummaryCards(
    [...specials, ...newArrivals],
    profile,
    prefs,
    OPENAI_API_KEY,
    OPENAI_MODEL
  );

  return { specials, newArrivals, summaryCards };
}
```

The old `buildNewsDiscoveryPrompt` and `validateGptNewsResponse` functions can be removed.

---

## Task 8: Update `app/api/news/refresh/route.ts`

Add a zero-count warning:

```typescript
const count = discovered.specials.length + discovered.newArrivals.length;
if (count === 0) {
  console.warn("[api/news/refresh] zero items discovered — check GPT logs for validation failures");
}
console.log(`[api/news/refresh] success — ${count} items in refresh ${refreshId}`);
```

---

## Task 9: Update tests

In `tests/news-gpt-validation.test.ts`:
- Keep all existing `validateGptOffer` tests unchanged (function signature unchanged)
- Remove or update any tests importing `validateGptNewsResponse` (function replaced by `validateAndDedupe`)
- Export `validateAndDedupe` from `lib/news-gpt.ts` for testability, add tests covering:
  - Valid specials and new arrivals pass through
  - Invalid items are counted in `rejectionCount`
  - Duplicate URLs are deduplicated
- Add test for `buildRetailerPrompt`: verify it includes the correct domain, source key, and the "include ALL items regardless of price" instruction

---

## Verification Checklist

- [ ] Vercel logs show 5 per-retailer discovery attempts
- [ ] Refresh returns items from all 5 retailers
- [ ] Whisky Brother new arrivals appear in the feed
- [ ] Above-budget items are included and flagged, not filtered
- [ ] One retailer API failure does not fail the whole refresh
- [ ] Summary cards reference real items from the discovered list
- [ ] Validation rejections appear as a single consolidated log line
- [ ] All tests pass

---

## What NOT to Change

- `validateGptOffer` — validation rules are correct, keep as-is
- `APPROVED_SOURCE_DOMAINS` — keep as-is
- `GptOffer`, `GptNewsResponse`, `GptSummaryCardShape` types — keep as-is
- `extractCard`, `getResponsesText`, `extractJson` helpers — keep as-is
- `lib/news-store.ts`, `lib/news-budget.ts`, `lib/news-preferences-store.ts` — no changes
- All UI components — no changes
- Database schema — no changes

---

## Architecture Notes

- **6 total API calls per refresh** (5 retailer + 1 summary) vs 1 previously — increased cost, significantly increased quality and coverage
- **Parallel execution** — 5 retailer calls run concurrently; total wall time ≈ slowest single retailer call, not 5×
- **Non-fatal retailer failures** — if one retailer's call fails, the others succeed and the refresh completes with partial results
- **Budget only in summary cards** — per-retailer prompts have no budget context; GPT cannot use budget as a reason to omit items
- **Chat Completions for summary cards** — no web search needed for this reasoning-only step
