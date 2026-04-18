# Tasting AI Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a floating tasting suggestion chat and an AI-powered session briefing + name generator to the tastings page.

**Architecture:** A new `TastingChat` component (floating FAB + panel) streams suggestions from `/api/tastings/advisor` using the same `useChat`/`DefaultChatTransport` pattern as `BottleChat`. A new `/api/tastings/briefing` endpoint returns a structured JSON response (suggested name + briefing sections) that gets formatted into the session form's title and notes fields. Both features wire into `TastingsHub` via callbacks — no new pages or state stores needed.

**Tech Stack:** Next.js App Router, AI SDK (`useChat`, `DefaultChatTransport`, `streamText`, `generateText`), OpenAI, Vitest, TypeScript

---

### Task 1: Add `buildTastingBottleContext` to `lib/advisor-context.ts`

**Files:**
- Modify: `lib/advisor-context.ts`
- Test: `tests/advisor-context.test.ts`

- [ ] **Step 1: Write the failing test**

Add at the bottom of `tests/advisor-context.test.ts`:

```typescript
import {
  detectContextTriggers,
  buildCollectionSummary,
  buildTastingBottleContext
} from "@/lib/advisor-context";

// (existing tests above)

describe("buildTastingBottleContext", () => {
  const makeItem = (overrides: Partial<CollectionViewItem> = {}): CollectionViewItem =>
    ({
      item: {
        id: "item-1",
        status: "owned",
        fillState: "sealed",
        rating: undefined,
        isFavorite: false,
        purchasePrice: undefined,
        purchaseCurrency: "ZAR",
        purchaseDate: undefined,
        purchaseSource: undefined,
        personalNotes: undefined
      },
      expression: {
        id: "exp-1",
        name: "Springbank 15",
        brand: "Springbank",
        distilleryName: "Springbank",
        bottlerName: "Springbank",
        country: "Scotland",
        abv: 46,
        ageStatement: 15,
        barcode: undefined,
        description: undefined,
        tags: ["bourbon-cask", "lightly-peated"],
        imageUrl: undefined
      },
      images: [],
      ...overrides
    } as CollectionViewItem);

  it("includes owned non-finished bottles", () => {
    const result = buildTastingBottleContext([makeItem()]);
    expect(result).toContain("Springbank 15");
    expect(result).toContain("item-1");
  });

  it("excludes finished bottles", () => {
    const item = makeItem({ item: { ...makeItem().item, fillState: "finished" } });
    const result = buildTastingBottleContext([item]);
    expect(result).not.toContain("Springbank 15");
  });

  it("excludes wishlist bottles", () => {
    const item = makeItem({ item: { ...makeItem().item, status: "wishlist" } });
    const result = buildTastingBottleContext([item]);
    expect(result).not.toContain("Springbank 15");
  });

  it("includes ABV and cask tags", () => {
    const result = buildTastingBottleContext([makeItem()]);
    expect(result).toContain("46%");
    expect(result).toContain("bourbon-cask");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/advisor-context.test.ts
```
Expected: FAIL — `buildTastingBottleContext` is not exported

- [ ] **Step 3: Add the function to `lib/advisor-context.ts`**

Add after `buildDrinkNowBlock`:

```typescript
export function buildTastingBottleContext(items: CollectionViewItem[]): string {
  const available = items.filter(
    (i) => i.item.status === "owned" && i.item.fillState !== "finished"
  );

  const lines = available.map((i) => {
    const e = i.expression;
    const abv = e.abv ? `${e.abv}%` : "ABV unknown";
    const age = e.ageStatement ? `${e.ageStatement}yo` : "NAS";
    const cask = e.tags.filter((t) => t.includes("cask")).join(", ") || "cask unknown";
    const peat = e.tags.find((t) => t.includes("peat") || t.includes("smoke")) ?? "unpeated";
    const notes = e.tags.filter((t) => !t.includes("cask") && !t.includes("peat") && !t.includes("smoke")).slice(0, 4).join(", ");
    const rating = i.item.rating ? ` | rated ${i.item.rating}/3${i.item.isFavorite ? " ★" : ""}` : "";
    const fill = i.item.fillState;
    return `- [id:${i.item.id}] ${e.name} | ${age} | ${abv} | ${peat} | ${cask}${notes ? ` | notes: ${notes}` : ""}${rating} | ${fill}`;
  });

  return ["AVAILABLE BOTTLES FOR TASTING:", ...lines].join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/advisor-context.test.ts
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/advisor-context.ts tests/advisor-context.test.ts
git commit -m "feat: add buildTastingBottleContext to advisor-context"
```

---

### Task 2: Add `POST /api/tastings/advisor` (streaming chat)

**Files:**
- Create: `app/api/tastings/advisor/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/tastings/advisor/route.ts`:

```typescript
import type { ModelMessage } from "@ai-sdk/provider-utils";
import { openai } from "@ai-sdk/openai";
import { createUIMessageStreamResponse, streamText } from "ai";
import type { UIMessage } from "ai";

import { buildTastingBottleContext, buildPalateContextBlock, buildRecentTastingSessionsBlock } from "@/lib/advisor-context";
import { getServerEnv } from "@/lib/env";
import { getDashboardData, getRecentTastingSessions } from "@/lib/repository";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { messages: UIMessage[] };
  const uiMessages = body.messages ?? [];

  const { OPENAI_MODEL } = getServerEnv();

  const [dashboard, recentSessions] = await Promise.all([
    getDashboardData(),
    getRecentTastingSessions(5)
  ]);

  const { collection, profile } = dashboard;

  const systemPrompt = `You are a tasting session advisor for a private whisky collection.

CONTEXT: The collector is based in South Africa. Prices are in ZAR (R). Standard bottle 750ml, 43%+ ABV.

${buildPalateContextBlock(profile)}

${buildTastingBottleContext(collection)}

${buildRecentTastingSessionsBlock(recentSessions)}

RULES:
- Only suggest bottles from the AVAILABLE BOTTLES list above using their exact [id:...] identifiers.
- When suggesting bottles for a session, format each bottle as:
  ### Bottle Name
  - Why it fits: reason tied to occasion or palate
- After your bottle recommendations, ALWAYS include a JSON block on its own line with the suggested bottle IDs:
  {"bottleSuggestions": [{"id": "item-id-here", "name": "Bottle Name"}]}
- Consider tasting order: lighter/unpeated before heavier/peated, lower ABV before cask strength.
- Keep answers concise and scannable.
- End each response with 2-3 follow-up chips: {"suggestions": ["...", "...", "..."]}`;

  const messages: ModelMessage[] = uiMessages.map((message) => {
    const content =
      message.parts?.map((part) => ("text" in part ? (part as { text: string }).text : "")).join(" ") || "";
    return { role: message.role as "user" | "assistant", content };
  });

  const result = streamText({
    model: openai(OPENAI_MODEL),
    system: systemPrompt,
    messages
  });

  return createUIMessageStreamResponse({ stream: result.toUIMessageStream() });
}
```

- [ ] **Step 2: Smoke test**

Start dev server (`npm run dev`) and POST to `/api/tastings/advisor`:

```bash
curl -X POST http://localhost:3000/api/tastings/advisor \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"id":"1","role":"user","parts":[{"type":"text","text":"suggest 3 bottles for a casual Friday evening"}]}]}'
```
Expected: streaming response with bottle suggestions and a `{"bottleSuggestions":[...]}` block.

- [ ] **Step 3: Commit**

```bash
git add app/api/tastings/advisor/route.ts
git commit -m "feat: add /api/tastings/advisor streaming chat route"
```

---

### Task 3: Add `POST /api/tastings/briefing` (name + structured briefing)

**Files:**
- Create: `app/api/tastings/briefing/route.ts`
- Test: `tests/tastings-api-shape.test.ts`

- [ ] **Step 1: Write the failing test**

Open `tests/tastings-api-shape.test.ts` and add at the bottom:

```typescript
import { describe, it, expect } from "vitest";

describe("formatBriefingAsText", () => {
  it("formats tasting order section", () => {
    const { formatBriefingAsText } = await import("@/app/api/tastings/briefing/route");
    const briefing = {
      tastingOrder: [
        { bottleName: "Glenlivet 12", reason: "Lightest — good opener" },
        { bottleName: "Ardbeg 10", reason: "Heavy peat — best last" }
      ],
      bottleProfiles: [],
      tips: []
    };
    const result = formatBriefingAsText(briefing);
    expect(result).toContain("## Tasting Order");
    expect(result).toContain("1. Glenlivet 12");
    expect(result).toContain("Lightest — good opener");
  });

  it("formats bottle profiles section", () => {
    const { formatBriefingAsText } = await import("@/app/api/tastings/briefing/route");
    const briefing = {
      tastingOrder: [],
      bottleProfiles: [
        {
          bottleName: "Ardbeg 10",
          keyNotes: ["smoke", "citrus"],
          watchFor: "The medicinal finish.",
          background: "Islay distillery."
        }
      ],
      tips: ["Serve neat"]
    };
    const result = formatBriefingAsText(briefing);
    expect(result).toContain("### Ardbeg 10");
    expect(result).toContain("smoke, citrus");
    expect(result).toContain("The medicinal finish.");
    expect(result).toContain("## Tips");
    expect(result).toContain("- Serve neat");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/tastings-api-shape.test.ts
```
Expected: FAIL — `formatBriefingAsText` not exported

- [ ] **Step 3: Create the route**

Create `app/api/tastings/briefing/route.ts`:

```typescript
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env";
import { getCollectionView, getTastingGroups, getTastingPlaces, getTastingPeople } from "@/lib/repository";

interface BriefingRequest {
  bottleItemIds: string[];
  placeId?: string | null;
  groupId?: string | null;
  attendeePersonIds?: string[];
  occasionType?: string | null;
}

interface BottleProfile {
  bottleName: string;
  keyNotes: string[];
  watchFor: string;
  background: string;
}

interface Briefing {
  tastingOrder: Array<{ bottleName: string; reason: string }>;
  bottleProfiles: BottleProfile[];
  tips: string[];
}

interface BriefingResponse {
  suggestedName: string;
  briefing: Briefing;
}

export function formatBriefingAsText(briefing: Briefing): string {
  const sections: string[] = [];

  if (briefing.tastingOrder.length > 0) {
    sections.push("## Tasting Order");
    briefing.tastingOrder.forEach((entry, index) => {
      sections.push(`${index + 1}. ${entry.bottleName} — ${entry.reason}`);
    });
  }

  if (briefing.bottleProfiles.length > 0) {
    sections.push("\n## Bottle Profiles");
    for (const profile of briefing.bottleProfiles) {
      sections.push(`### ${profile.bottleName}`);
      if (profile.keyNotes.length > 0) {
        sections.push(`Key notes: ${profile.keyNotes.join(", ")}`);
      }
      if (profile.watchFor) {
        sections.push(`Watch for: ${profile.watchFor}`);
      }
      if (profile.background) {
        sections.push(`Background: ${profile.background}`);
      }
    }
  }

  if (briefing.tips.length > 0) {
    sections.push("\n## Tips");
    for (const tip of briefing.tips) {
      sections.push(`- ${tip}`);
    }
  }

  return sections.join("\n");
}

export async function POST(req: Request) {
  const body = (await req.json()) as BriefingRequest;
  const { bottleItemIds, placeId, groupId, attendeePersonIds = [], occasionType } = body;

  if (bottleItemIds.length === 0) {
    return NextResponse.json({ error: "No bottles selected" }, { status: 400 });
  }

  const { OPENAI_MODEL } = getServerEnv();

  const [collection, groups, places, people] = await Promise.all([
    getCollectionView(),
    getTastingGroups(),
    getTastingPlaces(),
    getTastingPeople()
  ]);

  const selectedBottles = collection.filter((item) => bottleItemIds.includes(item.item.id));
  const place = placeId ? places.find((p) => p.id === placeId) : null;
  const group = groupId ? groups.find((g) => g.id === groupId) : null;
  const attendees = people.filter((p) => attendeePersonIds.includes(p.id));

  const bottleDescriptions = selectedBottles.map((i) => {
    const e = i.expression;
    const tags = e.tags.join(", ");
    return `- ${e.name} | ${e.distilleryName ?? "unknown distillery"} | ${e.abv ? `${e.abv}%` : "ABV unknown"} | ${e.ageStatement ? `${e.ageStatement}yo` : "NAS"} | tags: ${tags || "none"}`;
  }).join("\n");

  const contextLines = [
    `Bottles (${selectedBottles.length}):`,
    bottleDescriptions,
    place ? `Place: ${place.name}` : "",
    group ? `Group: ${group.name}` : "",
    attendees.length > 0
      ? `Attendees: ${attendees.map((a) => `${a.name}${a.preferenceTags.length ? ` (likes ${a.preferenceTags.join(", ")})` : ""}`).join(", ")}`
      : "",
    occasionType ? `Occasion: ${occasionType}` : ""
  ].filter(Boolean).join("\n");

  const prompt = `You are a whisky tasting host. Given the following tasting context, return a JSON object (and nothing else) in this exact shape:

{
  "suggestedName": "A short evocative tasting name (max 6 words, based on the bottles, place, occasion, or group)",
  "briefing": {
    "tastingOrder": [
      { "bottleName": "exact bottle name", "reason": "why this position in the order" }
    ],
    "bottleProfiles": [
      {
        "bottleName": "exact bottle name",
        "keyNotes": ["note1", "note2", "note3"],
        "watchFor": "one sentence on what to pay attention to",
        "background": "one sentence of interesting context"
      }
    ],
    "tips": ["tip1", "tip2"]
  }
}

TASTING CONTEXT:
${contextLines}

Return only the JSON object. No markdown, no explanation.`;

  const { text } = await generateText({
    model: openai(OPENAI_MODEL),
    prompt
  });

  let parsed: BriefingResponse;
  try {
    parsed = JSON.parse(text) as BriefingResponse;
  } catch {
    return NextResponse.json({ error: "Could not parse AI response" }, { status: 500 });
  }

  return NextResponse.json(parsed);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/tastings-api-shape.test.ts
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/tastings/briefing/route.ts tests/tastings-api-shape.test.ts
git commit -m "feat: add /api/tastings/briefing route with formatBriefingAsText"
```

---

### Task 4: Create `TastingChat` component

**Files:**
- Create: `components/tasting-chat.tsx`
- Test: `tests/logic.test.ts`

- [ ] **Step 1: Write the failing test**

Open `tests/logic.test.ts` and add:

```typescript
import { describe, it, expect } from "vitest";

describe("extractBottleSuggestions", () => {
  const { extractBottleSuggestions } = await import("@/components/tasting-chat");

  it("returns empty array when no JSON block", () => {
    const result = extractBottleSuggestions("Here are some bottles for you.");
    expect(result.bottles).toEqual([]);
    expect(result.text).toBe("Here are some bottles for you.");
  });

  it("parses bottle suggestions from JSON block", () => {
    const content = 'Try these:\n{"bottleSuggestions":[{"id":"abc","name":"Ardbeg 10"}]}';
    const result = extractBottleSuggestions(content);
    expect(result.bottles).toEqual([{ id: "abc", name: "Ardbeg 10" }]);
    expect(result.text).toBe("Try these:");
  });

  it("leaves text intact when JSON block is malformed", () => {
    const content = 'text {"bottleSuggestions": bad json}';
    const result = extractBottleSuggestions(content);
    expect(result.bottles).toEqual([]);
    expect(result.text).toBe(content);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/logic.test.ts
```
Expected: FAIL — `extractBottleSuggestions` not exported

- [ ] **Step 3: Create `components/tasting-chat.tsx`**

```typescript
"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";

import { ChatMessageContent } from "@/components/chat-message-content";

const DEFAULT_CHIPS = [
  "Suggest bottles for a casual evening",
  "What would work for whisky newcomers?",
  "Plan a peaty session",
  "What pairs well for a dinner tasting?"
];

export interface BottleSuggestion {
  id: string;
  name: string;
}

export function extractBottleSuggestions(content: string): {
  text: string;
  bottles: BottleSuggestion[];
} {
  const match = content.match(/\{"bottleSuggestions":\s*\[[\s\S]*?\]\}/);
  if (!match) return { text: content, bottles: [] };
  try {
    const parsed = JSON.parse(match[0]) as { bottleSuggestions: BottleSuggestion[] };
    const text = content.replace(match[0], "").trim();
    return { text, bottles: parsed.bottleSuggestions };
  } catch {
    return { text: content, bottles: [] };
  }
}

function extractChips(content: string): string[] {
  const match = content.match(/\{"suggestions":\s*\[([^\]]*)\]\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as { suggestions: string[] };
    return parsed.suggestions;
  } catch {
    return [];
  }
}

function stripJsonBlocks(content: string): string {
  return content
    .replace(/\{"bottleSuggestions":\s*\[[\s\S]*?\]\}/, "")
    .replace(/\{"suggestions":\s*\[[^\]]*\]\}/, "")
    .trim();
}

interface TastingChatProps {
  onApply: (bottleIds: string[]) => void;
}

export function TastingChat({ onApply }: TastingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [chips, setChips] = useState<string[]>(DEFAULT_CHIPS);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [transport] = useState(
    () => new DefaultChatTransport({ api: "/api/tastings/advisor" })
  );

  const { messages, sendMessage, status } = useChat({ transport });
  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    let last: UIMessage | undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") { last = messages[i]; break; }
    }
    if (!last) return;
    const textPart = last.parts.find((p) => p.type === "text");
    if (!textPart || !("text" in textPart)) return;
    const text = (textPart as { text: string }).text;
    const newChips = extractChips(text);
    if (newChips.length) setChips(newChips);
  }, [messages]);

  function handleChip(chip: string) {
    sendMessage({ parts: [{ type: "text", text: chip }] });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!input.trim()) return;
    sendMessage({ parts: [{ type: "text", text: input }] });
    setInput("");
  }

  const displayMessages = messages.filter((m) => {
    const t = m.parts.find((p) => p.type === "text");
    return t && "text" in t;
  });

  return (
    <>
      <button
        aria-label={isOpen ? "Close tasting advisor" : "Ask for tasting suggestions"}
        className="bottle-chat__fab tasting-chat__fab"
        onClick={() => setIsOpen((v) => !v)}
        title={isOpen ? "Close" : "Tasting suggestions"}
      >
        <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" width="22">
          <path
            d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </button>

      <div
        aria-label="Tasting suggestion advisor"
        aria-modal="false"
        className={`bottle-chat__panel tasting-chat__panel${isOpen ? " bottle-chat__panel--open" : ""}`}
        role="dialog"
      >
        <div className="bottle-chat__header">
          <span className="bottle-chat__header-title">
            <span className="bottle-chat__header-eyebrow">Advisor</span>
            <span className="bottle-chat__header-name">Tasting Suggestions</span>
          </span>
          <button
            aria-label="Close chat"
            className="bottle-chat__close"
            onClick={() => setIsOpen(false)}
          >
            Close
          </button>
        </div>

        <div className="bottle-chat__messages">
          {displayMessages.length === 0 && (
            <div className="bottle-chat__empty">
              Ask me what to pour tonight — I'll suggest bottles from your collection and explain the order.
            </div>
          )}

          {displayMessages.map((message) => {
            const textPart = message.parts.find((p) => p.type === "text");
            const raw = textPart && "text" in textPart ? (textPart as { text: string }).text : "";
            const { text: cleanText, bottles } = extractBottleSuggestions(raw);
            const displayText = stripJsonBlocks(cleanText);

            return (
              <div
                className={`bottle-chat__message bottle-chat__message--${message.role}`}
                key={message.id}
              >
                <ChatMessageContent content={displayText} />
                {message.role === "assistant" && bottles.length > 0 && (
                  <button
                    className="button tasting-chat__apply"
                    onClick={() => {
                      onApply(bottles.map((b) => b.id));
                      setIsOpen(false);
                    }}
                    type="button"
                  >
                    Apply to session ({bottles.length} bottles)
                  </button>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="bottle-chat__message bottle-chat__message--assistant">
              <span className="bottle-chat__thinking">thinking...</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="bottle-chat__chips">
          {chips.map((chip) => (
            <button
              className="bottle-chat__chip"
              disabled={isLoading}
              key={chip}
              onClick={() => handleChip(chip)}
            >
              {chip}
            </button>
          ))}
        </div>

        <form className="bottle-chat__input-row" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            autoComplete="off"
            className="bottle-chat__input"
            disabled={isLoading}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about what to pour..."
            value={input}
          />
          <button
            aria-label="Send"
            className="bottle-chat__send"
            disabled={isLoading || !input.trim()}
            type="submit"
          >
            Send
          </button>
        </form>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/logic.test.ts
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add components/tasting-chat.tsx tests/logic.test.ts
git commit -m "feat: add TastingChat component with extractBottleSuggestions"
```

---

### Task 5: Add CSS for `tasting-chat__` classes

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add CSS**

At the end of `app/globals.css`, add:

```css
/* ── Tasting Chat (floating popup) ───────────────────────────────────────── */

.tasting-chat__fab {
  bottom: 28px;
  right: 92px; /* offset left of bottle-chat__fab which is at right: 28px */
}

.tasting-chat__panel {
  right: 92px;
}

.tasting-chat__apply {
  margin-top: 10px;
  font-size: 0.85rem;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "feat: add tasting-chat CSS positioning"
```

---

### Task 6: Wire `TastingChat` into `TastingsHub` and add briefing buttons

**Files:**
- Modify: `components/tastings-hub.tsx`

- [ ] **Step 1: Import `TastingChat` and add a sparkle icon**

At the top of `components/tastings-hub.tsx`, add the import after the existing imports:

```typescript
import { TastingChat } from "@/components/tasting-chat";
```

Add a `SparkleIcon` helper function at the top of the component (before `TastingSection`):

```typescript
function SparkleIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" height="14" viewBox="0 0 24 24" width="14">
      <path d="m12 2 1.76 5.24L19 9l-5.24 1.76L12 16l-1.76-5.24L5 9l5.24-1.76L12 2Zm7 11 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3ZM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z" />
    </svg>
  );
}
```

- [ ] **Step 2: Add `isBriefingLoading` state and `handleGenerateBriefing` function**

In `TastingsHub`, after the existing `useState` declarations (around line 248), add:

```typescript
const [isBriefingLoading, setIsBriefingLoading] = useState(false);
```

After the `resetSessionForm` function (around line 383), add:

```typescript
async function handleGenerateBriefing() {
  if (sessionForm.bottleItemIds.length === 0) return;
  setIsBriefingLoading(true);
  try {
    const response = await fetch("/api/tastings/briefing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bottleItemIds: sessionForm.bottleItemIds,
        placeId: sessionForm.placeId || null,
        groupId: sessionForm.groupId || null,
        attendeePersonIds: sessionForm.attendeePersonIds,
        occasionType: sessionForm.occasionType
      })
    });
    if (!response.ok) {
      setNotice({ tone: "error", text: "Could not generate briefing." });
      return;
    }
    const data = (await response.json()) as {
      suggestedName: string;
      briefing: {
        tastingOrder: Array<{ bottleName: string; reason: string }>;
        bottleProfiles: Array<{
          bottleName: string;
          keyNotes: string[];
          watchFor: string;
          background: string;
        }>;
        tips: string[];
      };
    };

    const sections: string[] = [];
    if (data.briefing.tastingOrder.length > 0) {
      sections.push("## Tasting Order");
      data.briefing.tastingOrder.forEach((entry, i) => {
        sections.push(`${i + 1}. ${entry.bottleName} — ${entry.reason}`);
      });
    }
    if (data.briefing.bottleProfiles.length > 0) {
      sections.push("\n## Bottle Profiles");
      for (const profile of data.briefing.bottleProfiles) {
        sections.push(`### ${profile.bottleName}`);
        if (profile.keyNotes.length > 0) sections.push(`Key notes: ${profile.keyNotes.join(", ")}`);
        if (profile.watchFor) sections.push(`Watch for: ${profile.watchFor}`);
        if (profile.background) sections.push(`Background: ${profile.background}`);
      }
    }
    if (data.briefing.tips.length > 0) {
      sections.push("\n## Tips");
      data.briefing.tips.forEach((tip) => sections.push(`- ${tip}`));
    }

    setSessionForm((current) => ({
      ...current,
      title: current.title || data.suggestedName,
      notes: sections.join("\n")
    }));

    setNotice({ tone: "success", text: "Briefing generated. Review and edit before saving." });
  } catch {
    setNotice({ tone: "error", text: "Could not generate briefing." });
  } finally {
    setIsBriefingLoading(false);
  }
}

async function handleSuggestName() {
  if (sessionForm.bottleItemIds.length === 0) return;
  setIsBriefingLoading(true);
  try {
    const response = await fetch("/api/tastings/briefing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bottleItemIds: sessionForm.bottleItemIds,
        placeId: sessionForm.placeId || null,
        groupId: sessionForm.groupId || null,
        attendeePersonIds: sessionForm.attendeePersonIds,
        occasionType: sessionForm.occasionType
      })
    });
    if (!response.ok) return;
    const data = (await response.json()) as { suggestedName: string };
    setSessionForm((current) => ({ ...current, title: data.suggestedName }));
  } catch {
    // silent — user can type manually
  } finally {
    setIsBriefingLoading(false);
  }
}
```

- [ ] **Step 3: Update the session title field to include the sparkle button**

Find the title field in the session form (around line 919–931):

```typescript
          <div className="field">
            <label htmlFor="session-title">Title</label>
            <input
              id="session-title"
              onChange={(event) =>
                setSessionForm((current) => ({
                  ...current,
                  title: event.target.value
                }))
              }
              placeholder="Whisky Friday at home"
              value={sessionForm.title}
            />
          </div>
```

Replace with:

```typescript
          <div className="field">
            <label htmlFor="session-title">Title</label>
            <div className="tasting-input-with-action">
              <input
                id="session-title"
                onChange={(event) =>
                  setSessionForm((current) => ({
                    ...current,
                    title: event.target.value
                  }))
                }
                placeholder="Whisky Friday at home"
                value={sessionForm.title}
              />
              <button
                aria-label="Suggest a name with AI"
                className="detail-icon-button"
                disabled={sessionForm.bottleItemIds.length === 0 || isBriefingLoading}
                onClick={handleSuggestName}
                title="Suggest a session name"
                type="button"
              >
                <SparkleIcon />
              </button>
            </div>
          </div>
```

- [ ] **Step 4: Update the session notes field to include the briefing button**

Find the notes field (around line 1007–1020):

```typescript
          <div className="field full-span">
            <label htmlFor="session-notes">Notes</label>
            <textarea
              id="session-notes"
              onChange={(event) =>
                setSessionForm((current) => ({
                  ...current,
                  notes: event.target.value
                }))
              }
              placeholder="Anything worth remembering about the lineup or the company."
              value={sessionForm.notes}
            />
          </div>
```

Replace with:

```typescript
          <div className="field full-span">
            <div className="tasting-label-with-action">
              <label htmlFor="session-notes">Notes</label>
              <button
                className="button-subtle tasting-briefing-btn"
                disabled={sessionForm.bottleItemIds.length === 0 || isBriefingLoading}
                onClick={handleGenerateBriefing}
                type="button"
              >
                {isBriefingLoading ? "Generating..." : "✦ Generate briefing"}
              </button>
            </div>
            <textarea
              id="session-notes"
              onChange={(event) =>
                setSessionForm((current) => ({
                  ...current,
                  notes: event.target.value
                }))
              }
              placeholder="Anything worth remembering about the lineup or the company."
              value={sessionForm.notes}
            />
          </div>
```

- [ ] **Step 5: Add `onApply` callback and render `TastingChat`**

In the `TastingsHub` return, find the hero `<section>` closing tag (around line 741) and add after it:

```typescript
      <TastingChat
        onApply={(bottleItemIds) => {
          setSessionForm((current) => ({ ...current, bottleItemIds }));
          openSectionAndScroll("log-session", setSessionOpen);
        }}
      />
```

Also update the hero action "Ask advisor what to take" link — remove it since the floating chat replaces it:

```typescript
          {/* removed: <a className="button-subtle" href="/advisor">Ask advisor what to take</a> */}
```

Delete that line entirely.

- [ ] **Step 6: Add CSS for new layout helpers**

In `app/globals.css`, add after the tasting-chat section:

```css
.tasting-input-with-action {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tasting-input-with-action input {
  flex: 1;
}

.tasting-label-with-action {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.tasting-briefing-btn {
  font-size: 0.8rem;
  white-space: nowrap;
}
```

- [ ] **Step 7: Verify the build compiles**

```bash
npx tsc --noEmit
```
Expected: no type errors

- [ ] **Step 8: Commit**

```bash
git add components/tastings-hub.tsx app/globals.css
git commit -m "feat: wire TastingChat and AI briefing/name buttons into TastingsHub"
```

---

### Task 7: Manual smoke test

- [ ] **Step 1: Start dev server and open the tastings page**

```bash
npm run dev
```
Open `http://localhost:3000/tastings`

- [ ] **Step 2: Test Feature A — Tasting suggestion chat**
  1. Click the floating chat button (left of any existing FAB)
  2. Click a chip or type "suggest 3 bottles for a casual evening"
  3. Verify the response includes bottle recommendations and a JSON block is NOT visible in the UI
  4. Verify an "Apply to session (N bottles)" button appears
  5. Click "Apply to session" — the Log Session section should open/scroll and the lineup should be populated
  6. Verify no data is saved (no API call to `/api/tastings/sessions`)

- [ ] **Step 3: Test Feature B — AI briefing**
  1. Open "Log Session", select 2+ bottles from the lineup picker
  2. Verify the sparkle button next to Title is enabled; click it
  3. Verify the title field is populated with a suggested name
  4. Verify the "✦ Generate briefing" button is enabled; click it
  5. Verify the notes textarea is populated with ## Tasting Order, ## Bottle Profiles, ## Tips sections
  6. Edit a note, save the session — verify the edited notes are saved correctly

- [ ] **Step 4: Test disabled states**
  1. Open "Log Session" with no bottles selected
  2. Verify sparkle button and generate briefing button are both disabled

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: tasting AI assistant — chat suggestions and session briefing"
git push
```
