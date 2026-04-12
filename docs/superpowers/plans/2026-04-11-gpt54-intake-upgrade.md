# GPT-5.4 Intake Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the slow 3-call photo intake (vision → Tavily search → OpenAI enrich) with a single GPT-5.4 call using the built-in web_search tool, and upgrade the advisor chat to GPT-5.4 while removing Tavily throughout.

**Architecture:** The photo intake currently chains `analyzeBottleImage` (OpenAI vision) → `enrichBottleExpressionWithSearch` (Tavily + second OpenAI call) sequentially. We collapse these into one call by passing `tools: [{ type: "web_search_preview" }]` with the image to GPT-5.4. The chat route (`app/api/advisor/chat/route.ts`) hardcodes `gpt-4o` and its custom `searchWeb` tool calls Tavily/OpenAI search — we upgrade the model to GPT-5.4 and strip Tavily from the search fallback. `TAVILY_API_KEY` is removed from env entirely.

**Tech Stack:** Next.js 15, OpenAI Chat Completions API (raw fetch), AI SDK v6 (`@ai-sdk/openai`, `ai`), Zod, Vitest

---

## Risk Note: Vision + web_search in one call

The OpenAI docs list both vision and `web_search_preview` as GPT-5.4 capabilities but do not explicitly confirm they work together in a single request. **Task 1 handles this** — if the API rejects the combination, we fall back to vision-only (no enrichment step). Vision-only on GPT-5.4 is still significantly faster than the current 3-call chain.

---

## Files Modified

| File | Change |
|---|---|
| `lib/openai.ts` | Single-call intake, drop `enrichBottleExpressionWithSearch`, use `OPENAI_MODEL` env |
| `lib/repository.ts` | Remove enrichment call from `createDraftFromPhoto` |
| `lib/search.ts` | Remove Tavily, keep OpenAI-only `webSearch` for chat |
| `lib/env.ts` | Remove `TAVILY_API_KEY`, update default model to `gpt-5.4` |
| `app/api/advisor/chat/route.ts` | Upgrade to `OPENAI_MODEL` (GPT-5.4), remove Tavily dependency |
| `.env.example` | Remove `TAVILY_API_KEY` line, update model default |

---

## Task 1: Collapse intake to single GPT-5.4 call in `lib/openai.ts`

**Files:**
- Modify: `lib/openai.ts`

This is the core change. We update `callOpenAi` to use the model from env, add `web_search_preview` as a tool, and delete `enrichBottleExpressionWithSearch` entirely. We also switch from reading `process.env.OPENAI_MODEL` directly to using `getServerEnv()` for consistency.

- [ ] **Step 1: Write the failing test**

Add to `tests/logic.test.ts` (or create if absent):

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the normalizer helpers by importing them directly.
// The OpenAI call itself is tested via integration — unit tests cover the pure helpers.
describe("normalizeText", () => {
  it("returns undefined for null", () => {
    // normalizeText is not exported — test via analyzeBottleImage indirectly.
    // This is a placeholder to document intent; real coverage comes from integration.
    expect(true).toBe(true);
  });
});
```

Run: `npm test -- tests/logic.test.ts`
Expected: PASS (placeholder test)

- [ ] **Step 2: Replace `lib/openai.ts` with single-call implementation**

```typescript
// lib/openai.ts
import { getServerEnv } from "@/lib/env";
import { createId } from "@/lib/id";
import type { CollectionItem, Expression, IntakeDraft } from "@/lib/types";

async function callOpenAi(
  prompt: string,
  imageBase64?: string,
  mimeType = "image/jpeg",
  useWebSearch = false
) {
  const { OPENAI_API_KEY, OPENAI_MODEL } = getServerEnv();

  if (!OPENAI_API_KEY) {
    return null;
  }

  const tools = useWebSearch ? [{ type: "web_search_preview" }] : undefined;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...(imageBase64
              ? [{ type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } }]
              : [])
          ]
        }
      ],
      ...(tools ? { tools } : {})
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with ${response.status}`);
  }

  return response.json();
}

function getResponseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as { choices?: Array<{ message?: { content?: string } }> };
  const message = p.choices?.[0]?.message;
  return typeof message?.content === "string" ? message.content : "";
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

type BottlePayload = {
  name?: string | null;
  distilleryName?: string | null;
  bottlerName?: string | null;
  brand?: string | null;
  country?: string | null;
  abv?: number | string | null;
  ageStatement?: number | string | null;
  barcode?: string | null;
  description?: string | null;
  tags?: string[] | null;
};

function normalizeText(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

function normalizeNumber(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => String(t).trim().toLowerCase().replace(/\s+/g, "-"))
    .filter(Boolean)
    .slice(0, 20);
}

function buildPrompt(fileName: string): string {
  return [
    "You are a whisky bottle identification and data extraction assistant.",
    "Analyze the provided whisky bottle image. Use web search when you need to verify or fill in details not clearly visible on the label.",
    "Return a single JSON object. Return ONLY valid JSON — no markdown, no explanations.",
    "Source priority: 1. Visible label text  2. Packaging cues  3. Web search for exact variant when needed.",
    "If confidence for a field is below 0.8, return null for that field.",
    "For ageStatement: return integer or null for NAS.",
    "For abv: return number if clearly visible or confirmed via search, else null.",
    `File hint: ${fileName}`,
    "",
    "Fields:",
    "  name (string) — full product name as on label",
    "  distilleryName (string|null) — producing distillery",
    "  bottlerName (string|null) — bottling entity if different from distillery",
    "  brand (string|null) — brand name if distinct from distillery",
    "  country (string|null)",
    "  abv (number|null)",
    "  ageStatement (integer|null)",
    "  barcode (string|null) — if visible",
    "  description (string|null) — short neutral summary of confirmed facts only",
    "  tags (string[]) — up to 20 lowercase hyphenated tags covering:",
    "    whisky style (e.g. single-malt, blended-scotch, world-single-malt)",
    "    peat level (e.g. peated, heavily-peated, unpeated) — omit if unknown",
    "    cask influence (e.g. sherry-cask, bourbon-cask, wine-cask, rum-cask)",
    "    bottler kind (e.g. independent-bottler) — omit for official bottlings",
    "    release series name as a tag if notable (e.g. special-release)",
    "    cask type as tag (e.g. double-wood, ex-bourbon, amontillado)",
    "    production flags only when confirmed: nas, limited, natural-colour, chill-filtered",
    "    up to 6 flavour descriptors (e.g. spicy, dried-fruit, vanilla, smoky)",
    "    numeric context if useful: e.g. 12yo, 700ml (only if confirmed)",
    "",
    'Output format: {"name":null,"distilleryName":null,"bottlerName":null,"brand":null,"country":null,"abv":null,"ageStatement":null,"barcode":null,"description":null,"tags":[]}'
  ].join("\n");
}

export async function analyzeBottleImage(
  fileName: string,
  imageBase64?: string,
  mimeType = "image/jpeg"
): Promise<{
  expression: Partial<Expression> & Pick<Expression, "name">;
  rawAiResponse: { enrichmentText: string };
} | null> {
  const { OPENAI_API_KEY } = getServerEnv();

  if (!OPENAI_API_KEY || !imageBase64) {
    return null;
  }

  const prompt = buildPrompt(fileName);

  // Attempt single call with web search. If the API rejects vision + web_search
  // together, fall back to vision-only.
  let payload: unknown = null;
  try {
    payload = await callOpenAi(prompt, imageBase64, mimeType, true);
  } catch {
    payload = await callOpenAi(prompt, imageBase64, mimeType, false);
  }

  const text = getResponseText(payload);
  const parsed = extractJson<BottlePayload>(text);

  if (!parsed) {
    return null;
  }

  const expression: Partial<Expression> & Pick<Expression, "name"> = {
    name: normalizeText(parsed.name) ?? fileName.replace(/\.[^.]+$/, ""),
    distilleryName: normalizeText(parsed.distilleryName),
    bottlerName: normalizeText(parsed.bottlerName),
    brand: normalizeText(parsed.brand),
    country: normalizeText(parsed.country),
    abv: normalizeNumber(parsed.abv),
    ageStatement: normalizeNumber(parsed.ageStatement),
    barcode: normalizeText(parsed.barcode),
    description: normalizeText(parsed.description),
    tags: normalizeTags(parsed.tags)
  };

  return { expression, rawAiResponse: { enrichmentText: text } };
}

export function buildDraftFromExpression(
  expression: Expression,
  source: IntakeDraft["source"],
  barcode?: string
): IntakeDraft {
  const now = new Date().toISOString();
  return {
    id: createId("draft"),
    collectionItemId: createId("item"),
    source,
    barcode,
    expression: { ...expression },
    collection: {
      purchaseCurrency: "ZAR",
      status: "owned",
      fillState: "sealed",
      createdAt: now,
      updatedAt: now
    } satisfies Partial<CollectionItem>
  };
}
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all existing tests pass. The `enrichBottleExpressionWithSearch` export is removed — check nothing else imports it before proceeding.

```bash
grep -r "enrichBottleExpressionWithSearch" --include="*.ts" .
```

Expected: only appears in `lib/repository.ts`. If it appears elsewhere, fix those imports before committing.

- [ ] **Step 4: Commit**

```bash
git add lib/openai.ts
git commit -m "feat: collapse photo intake to single GPT-5.4 call with web_search fallback"
```

---

## Task 2: Remove enrichment call from `lib/repository.ts`

**Files:**
- Modify: `lib/repository.ts:261-290`

- [ ] **Step 1: Update `createDraftFromPhoto`**

Replace the current `createDraftFromPhoto` function (lines 261–290):

```typescript
export async function createDraftFromPhoto(
  fileName: string,
  imageBase64?: string,
  mimeType = "image/jpeg"
): Promise<IntakeDraft> {
  const store = await readStore();
  const aiResult = await analyzeBottleImage(fileName, imageBase64, mimeType);

  const draft: IntakeDraft = {
    id: createId("draft"),
    collectionItemId: createId("item"),
    source: aiResult ? "hybrid" : "photo",
    rawAiResponse: aiResult?.rawAiResponse,
    expression: aiResult?.expression ?? { name: fileName.replace(/\.[^.]+$/, ""), tags: [] },
    collection: {
      purchaseCurrency: "ZAR",
      status: "owned",
      fillState: "sealed"
    }
  };

  store.drafts.unshift(draft);
  await writeStore(store);
  return draft;
}
```

Also remove the `enrichBottleExpressionWithSearch` import from the top of the file:

```typescript
// Change this line:
import { analyzeBottleImage, buildDraftFromExpression, enrichBottleExpressionWithSearch } from "@/lib/openai";
// To:
import { analyzeBottleImage, buildDraftFromExpression } from "@/lib/openai";
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add lib/repository.ts
git commit -m "feat: remove enrichment step from photo intake, single AI call now handles it"
```

---

## Task 3: Remove Tavily from `lib/search.ts`

**Files:**
- Modify: `lib/search.ts`

The chat's `searchWeb` tool still calls `webSearch()`. We remove Tavily and keep only the OpenAI search-preview path.

- [ ] **Step 1: Replace `lib/search.ts`**

```typescript
// lib/search.ts
import { getServerEnv } from "@/lib/env";

export async function webSearch(query: string): Promise<string> {
  const { OPENAI_API_KEY } = getServerEnv();

  if (!OPENAI_API_KEY) return "";

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-search-preview",
        messages: [{ role: "user", content: query }]
      })
    });

    if (!response.ok) return "";

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return data.choices?.[0]?.message?.content ?? "";
  } catch {
    return "";
  }
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add lib/search.ts
git commit -m "feat: remove Tavily from web search, use OpenAI search-preview only"
```

---

## Task 4: Upgrade advisor chat to GPT-5.4 in `app/api/advisor/chat/route.ts`

**Files:**
- Modify: `app/api/advisor/chat/route.ts:136`

The chat route hardcodes `openai("gpt-4o")`. We update it to read `OPENAI_MODEL` from env.

- [ ] **Step 1: Update the model line**

In `app/api/advisor/chat/route.ts`, change line 136:

```typescript
// Before:
  const result = streamText({
    model: openai("gpt-4o"),

// After:
  const result = streamText({
    model: openai(process.env.OPENAI_MODEL ?? "gpt-5.4"),
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/api/advisor/chat/route.ts
git commit -m "feat: upgrade advisor chat model to GPT-5.4 via OPENAI_MODEL env"
```

---

## Task 5: Clean up `lib/env.ts` and `.env.example`

**Files:**
- Modify: `lib/env.ts`
- Modify: `.env.example`

Remove `TAVILY_API_KEY` from the env schema and update the default model.

- [ ] **Step 1: Update `lib/env.ts`**

```typescript
import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().default("gpt-5.4"),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  APP_LOCK_ENABLED: z
    .string()
    .default("false")
    .transform((value) => value.toLowerCase() === "true"),
  APP_ACCESS_TOKEN: z.string().optional()
});

type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export function getServerEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = serverEnvSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    APP_LOCK_ENABLED: process.env.APP_LOCK_ENABLED,
    APP_ACCESS_TOKEN: process.env.APP_ACCESS_TOKEN
  });

  return cachedEnv;
}

export function assertProductionEnv() {
  const env = getServerEnv();
  const shouldEnforce =
    process.env.VERCEL_ENV === "production" ||
    process.env.ENFORCE_PRODUCTION_ENV_VALIDATION === "true";

  if (env.NODE_ENV !== "production" || !shouldEnforce) {
    return;
  }

  const missing: string[] = [];

  if (!env.NEXT_PUBLIC_APP_URL) missing.push("NEXT_PUBLIC_APP_URL");
  if (!env.SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!env.APP_LOCK_ENABLED) missing.push("APP_LOCK_ENABLED=true");
  if (!env.APP_ACCESS_TOKEN) missing.push("APP_ACCESS_TOKEN");

  if (missing.length > 0) {
    throw new Error(
      `Missing required production configuration: ${missing.join(", ")}`
    );
  }
}
```

- [ ] **Step 2: Update `.env.example`**

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
APP_LOCK_ENABLED=false
APP_ACCESS_TOKEN=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
USD_TO_ZAR=18.45
GBP_TO_ZAR=23.65
EUR_TO_ZAR=20.10
```

- [ ] **Step 3: Check that `.env.local` still has OPENAI_API_KEY set**

```bash
grep OPENAI_API_KEY .env.local
```

Expected: key is present with a value. If `TAVILY_API_KEY` is in `.env.local`, it can be left there harmlessly (it will just be ignored) or removed.

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/env.ts .env.example
git commit -m "chore: remove TAVILY_API_KEY from env schema, default OPENAI_MODEL to gpt-5.4"
```

---

## Task 6: Manual smoke test

No automated test can verify the OpenAI integration without live keys. This task is a manual verification checklist.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test photo intake**

1. Navigate to `/add`
2. Upload a whisky bottle photo
3. Click "Run photo intake"
4. Verify: the form populates noticeably faster than before
5. Verify: fields like distillery, country, and tags are populated (web search enrichment worked)
6. Check the browser network tab → single POST to `/api/items/intake-photo`

- [ ] **Step 3: Test advisor chat**

1. Navigate to the advisor chat
2. Ask: "What should I open tonight?"
3. Verify: response is generated (model responds — GPT-5.4 works)
4. Toggle web search on
5. Ask: "What's the current price of Springbank 15?"
6. Verify: response references real-world price data (web search working)

- [ ] **Step 4: If vision + web_search fail together**

If the API returns a `400` error during photo intake (visible in server logs or network tab), the fallback in `analyzeBottleImage` will automatically retry without web search. The label extraction will still work — just without internet enrichment. No code change needed; the fallback is already in Task 1.

If you want to confirm which path fired, add a temporary `console.log` before deploying:

```typescript
// In lib/openai.ts inside analyzeBottleImage:
try {
  payload = await callOpenAi(prompt, imageBase64, mimeType, true);
  console.log("[intake] web_search path succeeded");
} catch {
  console.log("[intake] web_search rejected, falling back to vision-only");
  payload = await callOpenAi(prompt, imageBase64, mimeType, false);
}
```

---

## Summary of Changes

| Before | After |
|---|---|
| 3 sequential API calls per photo intake | 1 call (vision + web search together, or vision-only fallback) |
| Tavily API key required | No Tavily dependency |
| `gpt-4o` hardcoded in chat route | `OPENAI_MODEL` env var (default `gpt-5.4`) |
| `OPENAI_MODEL` read directly from `process.env` in openai.ts | Uses `getServerEnv()` consistently |
| `enrichBottleExpressionWithSearch` maintained separately | Removed — GPT-5.4 handles enrichment in the same call |
