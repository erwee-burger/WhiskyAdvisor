# Conversational Advisor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static drink-now/buy-next advisor page with a streaming chat interface powered by GPT-4o that answers any question about the user's whisky collection.

**Architecture:** A new `/api/advisor/chat` streaming route assembles smart context (always-on palate + collection summary, plus conditional detail fetched by keyword analysis) and pipes it to GPT-4o. The advisor page becomes chat-first, using the Vercel AI SDK `useChat` hook for streaming. Existing scoring logic and cards move into a collapsible insights section below.

**Tech Stack:** Next.js 15 App Router, Vercel AI SDK (`ai` package), OpenAI GPT-4o, localStorage for message persistence, existing `lib/advisor.ts` + `lib/profile.ts` + `lib/repository.ts`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `lib/advisor-context.ts` | Create | Assemble system prompt context — always-on + conditional |
| `app/api/advisor/chat/route.ts` | Create | Streaming POST endpoint |
| `components/advisor-chat.tsx` | Create | Chat UI with message list, streaming, input, chips |
| `components/advisor-insights.tsx` | Create | Collapsible palate profile + drink-now/buy-next cards |
| `app/advisor/page.tsx` | Modify | Chat-first layout, fetch initial context server-side |
| `package.json` | Modify | Add `ai` (Vercel AI SDK) and `cheerio` (used in news plan) |

---

## Task 1: Install Vercel AI SDK

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the ai package**

```bash
npm install ai
```

Expected output: added 1 package (or similar), no errors.

- [ ] **Step 2: Verify install**

```bash
node -e "require('ai'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add vercel ai sdk"
```

---

## Task 2: Build the context assembler

**Files:**
- Create: `lib/advisor-context.ts`
- Test: `lib/advisor-context.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/advisor-context.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { detectContextTriggers, buildCollectionSummary } from "@/lib/advisor-context";
import type { CollectionViewItem, PalateProfile } from "@/lib/types";

const emptyProfile: PalateProfile = {
  cards: [],
  favoredFlavorTags: [],
  favoredRegions: [],
  favoredCaskStyles: [],
  favoredPeatTag: null
};

describe("detectContextTriggers", () => {
  it("detects drink-now triggers", () => {
    const result = detectContextTriggers("what should I open tonight?");
    expect(result.drinkNow).toBe(true);
  });

  it("detects wishlist triggers", () => {
    const result = detectContextTriggers("what should I buy next");
    expect(result.wishlist).toBe(true);
  });

  it("detects analytics triggers", () => {
    const result = detectContextTriggers("how many bottles do I have");
    expect(result.analytics).toBe(true);
  });

  it("detects tasting triggers", () => {
    const result = detectContextTriggers("show me my tasting notes");
    expect(result.tastings).toBe(true);
  });

  it("detects bottle name triggers", () => {
    const result = detectContextTriggers("tell me about my Springbank 15");
    expect(result.bottleName).toBe("springbank 15");
  });

  it("detects deals triggers", () => {
    const result = detectContextTriggers("anything on special right now");
    expect(result.deals).toBe(true);
  });

  it("returns all false for generic query", () => {
    const result = detectContextTriggers("hello");
    expect(result.drinkNow).toBe(false);
    expect(result.wishlist).toBe(false);
    expect(result.analytics).toBe(false);
    expect(result.tastings).toBe(false);
    expect(result.deals).toBe(false);
    expect(result.bottleName).toBeNull();
  });
});

describe("buildCollectionSummary", () => {
  it("returns summary string with counts", () => {
    const items: CollectionViewItem[] = [
      {
        item: { id: "1", expressionId: "e1", status: "owned", fillState: "open", purchaseCurrency: "ZAR", createdAt: "", updatedAt: "" },
        expression: { id: "e1", name: "Springbank 15", distilleryName: "Springbank", country: "Scotland", tags: [] },
        tastingEntries: [],
        images: []
      }
    ];
    const summary = buildCollectionSummary(items);
    expect(summary).toContain("1 owned");
    expect(summary).toContain("Scotland");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/advisor-context.test.ts
```

Expected: FAIL — "cannot find module @/lib/advisor-context"

- [ ] **Step 3: Implement the context assembler**

Create `lib/advisor-context.ts`:

```ts
import type { CollectionViewItem, PalateProfile, AdvisorSuggestion, TastingEntry } from "@/lib/types";
import { buildCollectionAnalytics } from "@/lib/analytics";

export interface ContextTriggers {
  drinkNow: boolean;
  wishlist: boolean;
  analytics: boolean;
  tastings: boolean;
  deals: boolean;
  bottleName: string | null;
}

export function detectContextTriggers(query: string): ContextTriggers {
  const q = query.toLowerCase();

  const drinkNow = /open tonight|drink now|what should i have|what should i open|pour tonight/.test(q);
  const wishlist = /buy next|next purchase|wishlist|should i get|worth (it|buying)/.test(q);
  const analytics = /how many|collection stats|analytics|how much|total|count/.test(q);
  const tastings = /tasting note|my notes|rating|rated|my review/.test(q);
  const deals = /special|deal|discount|on sale|new release|just arrived|what.s new/.test(q);

  // Extract a bottle name if the query mentions one — grab text after "my" or "about"
  const bottleMatch = q.match(/(?:my|about|tell me about|open|is the)\s+([a-z0-9 ]+?)(?:\?|$|,|\.|right)/);
  const bottleName = bottleMatch ? bottleMatch[1].trim() : null;

  return { drinkNow, wishlist, analytics, tastings, deals, bottleName };
}

export function buildCollectionSummary(items: CollectionViewItem[]): string {
  const analytics = buildCollectionAnalytics(items);
  const topRegions = analytics.regionSplit.slice(0, 3).map(r => r.region).join(", ");
  const topDistilleries = analytics.distillerySplit?.slice(0, 3).map((d: { distillery: string }) => d.distillery).join(", ") ?? "";

  return [
    `Collection: ${analytics.totals.owned} owned, ${analytics.totals.wishlist} on wishlist.`,
    `Open bottles: ${analytics.totals.open}. Sealed: ${analytics.totals.sealed}. Finished: ${analytics.totals.finished}.`,
    topRegions ? `Top regions: ${topRegions}.` : "",
    topDistilleries ? `Top distilleries: ${topDistilleries}.` : ""
  ].filter(Boolean).join(" ");
}

export function buildPalateContextBlock(profile: PalateProfile): string {
  const lines = [
    "PALATE PROFILE:",
    profile.favoredPeatTag ? `Peat preference: ${profile.favoredPeatTag}` : "Peat preference: unknown (no tasting data yet)",
    profile.favoredRegions.length ? `Favored regions: ${profile.favoredRegions.join(", ")}` : "Favored regions: none yet",
    profile.favoredCaskStyles.length ? `Favored cask styles: ${profile.favoredCaskStyles.join(", ")}` : "Favored cask styles: none yet",
    profile.favoredFlavorTags.length ? `Top flavor tags: ${profile.favoredFlavorTags.join(", ")}` : "Flavor tags: none yet"
  ];
  return lines.join("\n");
}

export function buildSuggestionsBlock(drinkNow: AdvisorSuggestion[], buyNext: AdvisorSuggestion[]): string {
  const dnLines = drinkNow.slice(0, 4).map(s => `  - ${s.title} (score: ${s.score}) — ${s.rationale}`);
  const bnLines = buyNext.slice(0, 4).map(s => `  - ${s.title} (score: ${s.score}) — ${s.rationale}`);
  return [
    "CURRENT ADVISOR PICKS:",
    "Drink now:",
    ...dnLines,
    "Buy next:",
    ...bnLines
  ].join("\n");
}

export function buildDrinkNowBlock(items: CollectionViewItem[]): string {
  const open = items.filter(i => i.item.status === "owned" && i.item.fillState !== "finished");
  const lines = open.map(i => {
    const rating = i.latestTasting ? ` (rated ${i.latestTasting.rating}/5)` : "";
    return `  - ${i.expression.name}${rating} [${i.item.fillState}]`;
  });
  return ["OWNED BOTTLES AVAILABLE TO DRINK:", ...lines].join("\n");
}

export function buildWishlistBlock(items: CollectionViewItem[]): string {
  const wishlist = items.filter(i => i.item.status === "wishlist");
  const lines = wishlist.map(i => {
    const price = i.item.purchasePrice ? ` — R${i.item.purchasePrice}` : "";
    return `  - ${i.expression.name}${price}`;
  });
  return ["WISHLIST:", ...lines].join("\n");
}

export function buildTastingsBlock(tastings: TastingEntry[], items: CollectionViewItem[]): string {
  const recent = tastings.slice(0, 10);
  const lines = recent.map(t => {
    const item = items.find(i => i.item.id === t.collectionItemId);
    const name = item?.expression.name ?? "Unknown";
    return `  - ${name} (${t.rating}/5): nose: ${t.nose}; palate: ${t.palate}; finish: ${t.finish}`;
  });
  return ["RECENT TASTING NOTES:", ...lines].join("\n");
}

export function buildBottleDetailBlock(query: string, items: CollectionViewItem[]): string {
  const q = query.toLowerCase();
  const match = items.find(i =>
    i.expression.name.toLowerCase().includes(q) ||
    (i.expression.distilleryName ?? "").toLowerCase().includes(q)
  );
  if (!match) return "";
  const e = match.expression;
  const t = match.latestTasting;
  return [
    `BOTTLE DETAIL: ${e.name}`,
    e.distilleryName ? `Distillery: ${e.distilleryName}` : "",
    e.country ? `Country: ${e.country}` : "",
    e.region ? `Region: ${e.region}` : "",
    e.abv ? `ABV: ${e.abv}%` : "",
    e.ageStatement ? `Age: ${e.ageStatement} years` : "",
    e.caskType ? `Cask: ${e.caskType}` : "",
    e.tags.length ? `Tags: ${e.tags.join(", ")}` : "",
    `Status: ${match.item.status}, ${match.item.fillState}`,
    t ? `Latest tasting (${t.rating}/5): ${t.overallNote}` : "No tasting notes yet"
  ].filter(Boolean).join("\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/advisor-context.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add lib/advisor-context.ts lib/advisor-context.test.ts
git commit -m "feat: add advisor context assembler with trigger detection"
```

---

## Task 3: Build the streaming chat API route

**Files:**
- Create: `app/api/advisor/chat/route.ts`

- [ ] **Step 1: Write the route**

Create `app/api/advisor/chat/route.ts`:

```ts
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import type { Message } from "ai";
import {
  detectContextTriggers,
  buildCollectionSummary,
  buildPalateContextBlock,
  buildSuggestionsBlock,
  buildDrinkNowBlock,
  buildWishlistBlock,
  buildTastingsBlock,
  buildBottleDetailBlock
} from "@/lib/advisor-context";
import { getCollectionDashboard } from "@/lib/repository";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { messages, query } = (await req.json()) as { messages: Message[]; query: string };

  const dashboard = await getCollectionDashboard();
  const { collection, profile, drinkNow, buyNext } = dashboard;

  const triggers = detectContextTriggers(query);

  const contextBlocks: string[] = [
    buildPalateContextBlock(profile),
    buildCollectionSummary(collection),
    buildSuggestionsBlock(drinkNow, buyNext)
  ];

  if (triggers.drinkNow) {
    contextBlocks.push(buildDrinkNowBlock(collection));
  }

  if (triggers.wishlist) {
    contextBlocks.push(buildWishlistBlock(collection));
  }

  if (triggers.analytics) {
    const { buildCollectionAnalytics } = await import("@/lib/analytics");
    const analytics = buildCollectionAnalytics(collection);
    contextBlocks.push(`FULL ANALYTICS:\n${JSON.stringify(analytics, null, 2)}`);
  }

  if (triggers.tastings) {
    const allTastings = collection.flatMap(i => i.tastingEntries)
      .sort((a, b) => b.tastedAt.localeCompare(a.tastedAt));
    contextBlocks.push(buildTastingsBlock(allTastings, collection));
  }

  if (triggers.bottleName) {
    const detail = buildBottleDetailBlock(triggers.bottleName, collection);
    if (detail) contextBlocks.push(detail);
  }

  const systemPrompt = `You are a personal whisky advisor for this collection.

PERSONALITY: You are warm, opinionated, and genuinely enthusiastic about whisky. You adapt your tone to match how the user speaks — casual when they are casual, technical when they go deep. Underneath everything, you have strong opinions and aren't afraid to share them.

${contextBlocks.join("\n\n")}

RULES:
- Only advise based on what's in the collection context above
- If asked about something not in the context, say so honestly
- Never invent tasting notes or ratings the user hasn't written
- Keep responses conversational — no bullet-point walls unless the user asks
- When recommending a bottle, always give a reason tied to their actual palate
- At the end of each response, suggest 2-3 natural follow-up questions as a JSON block on its own line: {"suggestions": ["...", "...", "..."]}`;

  const result = streamText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    messages
  });

  return result.toDataStreamResponse();
}
```

- [ ] **Step 2: Install Vercel AI SDK OpenAI provider**

```bash
npm install @ai-sdk/openai
```

Expected: added 1 package, no errors.

- [ ] **Step 3: Verify the route file has no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no errors (or only pre-existing unrelated errors).

- [ ] **Step 4: Commit**

```bash
git add app/api/advisor/chat/route.ts package.json package-lock.json
git commit -m "feat: add streaming advisor chat API route"
```

---

## Task 4: Add `getCollectionDashboard` to repository

**Files:**
- Modify: `lib/repository.ts`

- [ ] **Step 1: Check if `getCollectionDashboard` already exists**

```bash
grep -n "getCollectionDashboard" lib/repository.ts
```

If it exists, skip to Step 3. If not, continue.

- [ ] **Step 2: Add the function to `lib/repository.ts`**

Open `lib/repository.ts` and add after the existing `getPalateProfile` function:

```ts
export async function getCollectionDashboard() {
  const collection = await getCollectionView();
  const profile = buildPalateProfile(collection.filter((entry) => entry.item.status === "owned"));
  return {
    collection,
    analytics: buildCollectionAnalytics(collection),
    profile,
    drinkNow: buildDrinkNowSuggestions(collection, profile),
    buyNext: buildBuyNextSuggestions(collection, profile)
  };
}
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/repository.ts
git commit -m "feat: add getCollectionDashboard repository helper"
```

---

## Task 5: Build the AdvisorInsights component

**Files:**
- Create: `components/advisor-insights.tsx`

- [ ] **Step 1: Create the collapsible insights component**

Create `components/advisor-insights.tsx`:

```tsx
"use client";

import { useState } from "react";
import { AdvisorCard } from "@/components/advisor-card";
import { ProfileCard } from "@/components/profile-card";
import type { AdvisorSuggestion, PalateProfile } from "@/lib/types";

interface Props {
  profile: PalateProfile;
  drinkNow: AdvisorSuggestion[];
  buyNext: AdvisorSuggestion[];
}

export function AdvisorInsights({ profile, drinkNow, buyNext }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="panel stack">
      <button
        className="section-title"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{ cursor: "pointer", background: "none", border: "none", width: "100%", textAlign: "left", padding: 0 }}
      >
        <div>
          <h2>{open ? "▼" : "▶"} Your profile &amp; picks</h2>
          <p>Palate profile cards and current advisor recommendations.</p>
        </div>
      </button>

      {open && (
        <>
          <div className="grid columns-2">
            {profile.cards.map((card) => (
              <ProfileCard card={card} key={card.title} />
            ))}
          </div>

          <div className="grid columns-2">
            <div className="stack">
              <h3>Drink now</h3>
              <div className="card-list">
                {drinkNow.map((suggestion) => (
                  <AdvisorCard key={suggestion.itemId} suggestion={suggestion} />
                ))}
              </div>
            </div>
            <div className="stack">
              <h3>Buy next</h3>
              <div className="card-list">
                {buyNext.map((suggestion) => (
                  <AdvisorCard key={suggestion.itemId} suggestion={suggestion} />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/advisor-insights.tsx
git commit -m "feat: add collapsible AdvisorInsights component"
```

---

## Task 6: Build the AdvisorChat component

**Files:**
- Create: `components/advisor-chat.tsx`

- [ ] **Step 1: Create the chat component**

Create `components/advisor-chat.tsx`:

```tsx
"use client";

import { useChat } from "ai/react";
import { useEffect, useRef, useState } from "react";
import type { Message } from "ai";

const STORAGE_KEY = "advisor-messages";
const MAX_MESSAGES = 20;
const SESSION_KEY = "advisor-opening-done";

const DEFAULT_CHIPS = [
  "What should I open tonight?",
  "What's missing from my shelf?",
  "Which bottle have I neglected the longest?",
  "Surprise me with an insight."
];

function loadMessages(): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Message[]) : [];
  } catch {
    return [];
  }
}

function saveMessages(messages: Message[]) {
  const capped = messages.slice(-MAX_MESSAGES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
}

function extractSuggestions(content: string): { text: string; suggestions: string[] } {
  const match = content.match(/\{"suggestions":\s*\[([^\]]*)\]\}/);
  if (!match) return { text: content, suggestions: [] };
  try {
    const parsed = JSON.parse(match[0]) as { suggestions: string[] };
    const text = content.replace(match[0], "").trim();
    return { text, suggestions: parsed.suggestions };
  } catch {
    return { text: content, suggestions: [] };
  }
}

export function AdvisorChat() {
  const initialMessages = loadMessages();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [chips, setChips] = useState<string[]>(DEFAULT_CHIPS);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages, append } =
    useChat({
      api: "/api/advisor/chat",
      initialMessages,
      body: (messages: Message[]) => ({
        query: messages[messages.length - 1]?.content ?? ""
      }),
      onFinish: (message) => {
        const { suggestions } = extractSuggestions(message.content);
        if (suggestions.length) setChips(suggestions);
        saveMessages([...messages, message]);
      }
    });

  // Fire opening message once per session
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    if (messages.length > 0) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    append({
      role: "user",
      content: "__opening__"
    });
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleChip(chip: string) {
    append({ role: "user", content: chip });
  }

  const displayMessages = messages.filter(m => m.content !== "__opening__");

  return (
    <div className="advisor-chat stack">
      <div className="advisor-chat__messages">
        {displayMessages.map((m) => {
          const { text } = extractSuggestions(m.content);
          return (
            <div
              key={m.id}
              className={`advisor-chat__message advisor-chat__message--${m.role}`}
            >
              <p>{text}</p>
            </div>
          );
        })}
        {isLoading && (
          <div className="advisor-chat__message advisor-chat__message--assistant">
            <p className="advisor-chat__thinking">thinking…</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="advisor-chat__chips">
        {chips.map((chip) => (
          <button
            key={chip}
            className="advisor-chat__chip"
            onClick={() => handleChip(chip)}
            disabled={isLoading}
          >
            {chip}
          </button>
        ))}
      </div>

      <form
        className="advisor-chat__input-row"
        onSubmit={(e) => {
          handleSubmit(e, {
            body: { query: input }
          });
        }}
      >
        <input
          className="advisor-chat__input"
          value={input}
          onChange={handleInputChange}
          placeholder="Ask anything about your collection…"
          disabled={isLoading}
          autoComplete="off"
        />
        <button
          type="submit"
          className="advisor-chat__send"
          disabled={isLoading || !input.trim()}
          aria-label="Send"
        >
          ▶
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/advisor-chat.tsx
git commit -m "feat: add AdvisorChat streaming component"
```

---

## Task 7: Restructure the advisor page

**Files:**
- Modify: `app/advisor/page.tsx`

- [ ] **Step 1: Read current advisor page**

Read `app/advisor/page.tsx` to understand current imports and structure before editing.

- [ ] **Step 2: Replace the page**

Replace the full contents of `app/advisor/page.tsx` with:

```tsx
import { AdvisorChat } from "@/components/advisor-chat";
import { AdvisorInsights } from "@/components/advisor-insights";
import { getCollectionDashboard } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function AdvisorPage() {
  const { profile, drinkNow, buyNext } = await getCollectionDashboard();

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Advisor</p>
        <h1>Your collection, talking back.</h1>
        <p>
          Ask anything — what to open tonight, what to buy next, what your palate
          actually looks like. Your advisor knows your shelf.
        </p>
      </section>

      <AdvisorChat />

      <AdvisorInsights
        profile={profile}
        drinkNow={drinkNow}
        buyNext={buyNext}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/advisor/page.tsx
git commit -m "feat: restructure advisor page as chat-first layout"
```

---

## Task 8: Add chat styles

**Files:**
- Modify: `app/globals.css` (or equivalent global stylesheet — check `app/layout.tsx` for the import)

- [ ] **Step 1: Find the global stylesheet**

```bash
grep -n "import.*css" app/layout.tsx
```

Note the path — likely `app/globals.css`.

- [ ] **Step 2: Append advisor chat styles**

Open the global stylesheet and append at the end:

```css
/* Advisor Chat */
.advisor-chat {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.advisor-chat__messages {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 200px;
  max-height: 500px;
  overflow-y: auto;
  padding: 1rem;
  border: 1px solid var(--border, #e5e5e5);
  border-radius: 8px;
}

.advisor-chat__message {
  max-width: 80%;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  line-height: 1.5;
}

.advisor-chat__message--user {
  align-self: flex-end;
  background: var(--accent, #2d2d2d);
  color: white;
}

.advisor-chat__message--assistant {
  align-self: flex-start;
  background: var(--surface-alt, #f5f5f5);
}

.advisor-chat__thinking {
  opacity: 0.5;
  font-style: italic;
}

.advisor-chat__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.advisor-chat__chip {
  padding: 0.4rem 0.85rem;
  border: 1px solid var(--border, #e5e5e5);
  border-radius: 20px;
  background: transparent;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.15s;
}

.advisor-chat__chip:hover:not(:disabled) {
  background: var(--surface-alt, #f5f5f5);
}

.advisor-chat__chip:disabled {
  opacity: 0.4;
  cursor: default;
}

.advisor-chat__input-row {
  display: flex;
  gap: 0.5rem;
}

.advisor-chat__input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border, #e5e5e5);
  border-radius: 8px;
  font-size: 1rem;
  background: var(--surface, white);
}

.advisor-chat__send {
  padding: 0.75rem 1.25rem;
  background: var(--accent, #2d2d2d);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
}

.advisor-chat__send:disabled {
  opacity: 0.4;
  cursor: default;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: add advisor chat styles"
```

---

## Task 9: Wire up the opening message system prompt

**Files:**
- Modify: `app/api/advisor/chat/route.ts`

The `__opening__` sentinel message needs a special system prompt injection so the AI greets the user with an insight rather than responding to a literal `__opening__` string.

- [ ] **Step 1: Update the route to handle the opening message**

Open `app/api/advisor/chat/route.ts` and replace the `messages` passed to `streamText` with:

```ts
  // Replace __opening__ sentinel with a greet instruction
  const processedMessages = messages.map(m =>
    m.content === "__opening__"
      ? { ...m, content: "Please greet me warmly and share one genuinely interesting insight from my collection. Keep it to 2-3 sentences. End with a follow-up suggestions JSON block." }
      : m
  );

  const result = streamText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    messages: processedMessages
  });
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/advisor/chat/route.ts
git commit -m "feat: handle advisor opening message sentinel"
```

---

## Task 10: Smoke test the full flow

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Navigate to `/advisor`**

Open `http://localhost:3000/advisor`. Expected:
- Page loads with chat UI
- An opening message appears from the AI within a few seconds
- Suggestion chips appear below the message list

- [ ] **Step 3: Ask a question**

Type "What should I open tonight?" and submit. Expected:
- User message appears right-aligned
- AI response streams in word-by-word
- New suggestion chips appear after response

- [ ] **Step 4: Verify persistence**

Refresh the page. Expected:
- Previous messages still visible (loaded from localStorage)
- No new opening message (sessionStorage flag prevents re-fire)

- [ ] **Step 5: Open the insights section**

Click "▶ Your profile & picks". Expected:
- Palate profile cards expand
- Drink-now and buy-next cards appear

- [ ] **Step 6: Commit any fixes discovered during smoke test**

```bash
git add -p
git commit -m "fix: smoke test corrections for conversational advisor"
```
