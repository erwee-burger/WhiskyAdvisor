# Database Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the database from 9 tables with ~100 columns and normalised FK relationships to 5 flat tables with ~40 columns, replacing enum/boolean fields with a unified `tags` text array.

**Architecture:** Drop `distilleries` and `bottlers` as separate tables — store `distillery_name` and `bottler_name` as plain text on `expressions`. Replace `peatLevel`, `caskInfluence`, `whiskyType`, `bottlerKind`, `isNas`, `isLimited`, `isChillFiltered`, `isNaturalColor`, `caskType`, `releaseSeries` with a single `tags text[]` column. Drop `citations` and `price_snapshots` entirely. Simplify `intake_drafts` to three JSONB blobs. Update all TypeScript types, repository, analytics, advisor, profile, comparison, and UI components to use the new flat model.

**Tech Stack:** Next.js 14, TypeScript, Supabase (PostgreSQL), Zod

---

## New Schema at a Glance

```
expressions
  id text PK
  name text NOT NULL
  distillery_name text
  bottler_name text
  brand text
  country text
  abv numeric
  age_statement int
  barcode text
  description text
  image_url text
  tags text[] NOT NULL DEFAULT '{}'
  -- tags absorb: whisky_type, peat_level, cask_influence, bottler_kind,
  --              cask_type, release_series, cask_number, bottle_number,
  --              outturn, vintage_year, distilled_year, bottled_year,
  --              volume_ml, is_nas, is_limited, is_chill_filtered,
  --              is_natural_color, flavor descriptors

collection_items
  id text PK
  expression_id text FK → expressions.id
  status text CHECK ('owned','wishlist')
  fill_state text CHECK ('sealed','open','finished')
  purchase_price numeric
  purchase_currency text DEFAULT 'ZAR'
  purchase_date date
  purchase_source text
  personal_notes text
  created_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()

tasting_entries
  id text PK
  collection_item_id text FK → collection_items.id ON DELETE CASCADE
  tasted_at date NOT NULL
  nose text NOT NULL
  palate text NOT NULL
  finish text NOT NULL
  overall_note text NOT NULL
  rating int CHECK (1-5)

item_images
  id text PK
  collection_item_id text FK → collection_items.id ON DELETE CASCADE
  kind text CHECK ('front','back','detail')
  url text NOT NULL
  label text

intake_drafts
  id text PK
  collection_item_id text NOT NULL
  source text CHECK ('photo','barcode','hybrid')
  barcode text
  raw_ai_response jsonb DEFAULT '{}'   -- raw OpenAI text blobs
  expression jsonb DEFAULT '{}'        -- flat expression fields + tags
  collection jsonb DEFAULT '{}'        -- status, fill_state, currency
  created_at timestamptz DEFAULT now()
```

**Dropped tables:** `distilleries`, `bottlers`, `citations`, `price_snapshots`

---

## Tag Conventions

Tags are lowercase, hyphen-separated strings stored in the `tags` array. The AI outputs them freely; the app treats known prefixes for filtering:

| Old field | Tag examples |
|---|---|
| `whiskyType` | `single-malt`, `blended-scotch`, `world-single-malt` |
| `peatLevel` | `peated`, `heavily-peated`, `unpeated` |
| `caskInfluence` | `sherry-cask`, `bourbon-cask`, `wine-cask`, `rum-cask` |
| `bottlerKind` | `independent-bottler` (absence = official) |
| `releaseSeries` | `special-release`, `solist`, etc. |
| `caskType` | `double-wood`, `amontillado-cask`, etc. |
| boolean flags | `nas`, `limited`, `natural-colour`, `chill-filtered` |
| flavor | `spicy`, `fruity`, `smoky`, etc. |
| numeric context | `12yo`, `700ml`, `46abv`, `cask-939`, `outturn-642` |

Numeric context tags are optional — the dedicated columns (`abv`, `age_statement`) remain. Tags like `12yo` are added by the AI for search/filter convenience.

---

## File Map

| File | Action | What changes |
|---|---|---|
| `lib/types.ts` | Modify | Drop `Distillery`, `Bottler`, `Citation`, `PriceSnapshot`, `PriceRange`, `PricePoint`, `FieldSuggestion`, `BottleIdentification`, `IntakeReviewItem`. Simplify `Expression`, `IntakeDraft`, `WhiskyStore`. New `IntakeRawExpression` with `tags`. |
| `lib/schemas.ts` | Modify | Simplify `bottleRecordSchema` — remove enum fields, add `tags` array |
| `lib/openai.ts` | Modify | Remove two-prompt flow. Single prompt returns flat fields + tags array. Store raw response text. Remove all enum normalisation lookups. |
| `lib/repository.ts` | Modify | Remove `ensureDistillery`, `ensureBottler`, `buildDraftView`, `buildExpressionRecord` complexity. Flat upsert directly. Remove advisor/pricing/citation logic. |
| `lib/supabase-store.ts` | Modify | Remove distilleries/bottlers/citations/prices tables. Simplified read/write for 5 tables. |
| `lib/mock-store.ts` | Modify | Seed data uses new flat schema |
| `lib/analytics.ts` | Modify | Replace `distillery.name`, `bottler.name`, `peatLevel`, `caskInfluence` field access with tag lookups |
| `lib/advisor.ts` | Modify | Replace `caskInfluence`, `peatLevel` field access with tag lookups |
| `lib/profile.ts` | Modify | Replace `caskInfluence`, `peatLevel` field access with tag lookups |
| `lib/comparison.ts` | Modify | Replace all dropped fields with `distillery_name`, `bottler_name`, `tags` |
| `components/collection-card.tsx` | Modify | Replace `distillery.name`, `bottler.name`, `peatLevel`, `caskInfluence`, `bottlerKind`, `isLimited`, `releaseSeries` with flat fields and tag lookups |
| `components/collection-browser.tsx` | Modify | Replace dropped field access with `distilleryName`, `bottlerName`, `tags` |
| `app/collection/[itemId]/page.tsx` | Modify | Replace all dropped field access |
| `components/add-bottle-form.tsx` | Modify | Replace enum selects with tag input. Remove distilleryId/bottlerId. |
| `supabase/migrations/` | Create | New migration file: drop old tables, add new columns, migrate data |

---

## Task 1: Simplify TypeScript types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Replace the contents of `lib/types.ts` with the simplified model**

```typescript
// lib/types.ts

export type CollectionStatus = "owned" | "wishlist";
export type FillState = "sealed" | "open" | "finished";
export type IntakeSource = "photo" | "barcode" | "hybrid";

export interface Expression {
  id: string;
  name: string;
  distilleryName?: string;
  bottlerName?: string;
  brand?: string;
  country?: string;
  abv?: number;
  ageStatement?: number;
  barcode?: string;
  description?: string;
  imageUrl?: string;
  tags: string[];
}

export interface CollectionItem {
  id: string;
  expressionId: string;
  status: CollectionStatus;
  fillState: FillState;
  purchasePrice?: number;
  purchaseCurrency: string;
  purchaseDate?: string;
  purchaseSource?: string;
  personalNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TastingEntry {
  id: string;
  collectionItemId: string;
  tastedAt: string;
  nose: string;
  palate: string;
  finish: string;
  overallNote: string;
  rating: 1 | 2 | 3 | 4 | 5;
}

export interface ItemImage {
  id: string;
  collectionItemId: string;
  kind: "front" | "back" | "detail";
  url: string;
  label?: string;
}

export interface IntakeDraft {
  id: string;
  collectionItemId: string;
  source: IntakeSource;
  barcode?: string;
  rawAiResponse?: {
    identificationText?: string;
    enrichmentText?: string;
  };
  expression: Partial<Expression> & Pick<Expression, "name">;
  collection: Partial<CollectionItem>;
}

export interface CollectionViewItem {
  item: CollectionItem;
  expression: Expression;
  tastingEntries: TastingEntry[];
  latestTasting?: TastingEntry;
  images: ItemImage[];
}

export interface CollectionAnalytics {
  totals: {
    owned: number;
    wishlist: number;
    open: number;
    sealed: number;
    finished: number;
  };
  bottleProfile: {
    brandTagged: number;
    nas: number;
    limited: number;
    chillFiltered: number;
    naturalColor: number;
  };
  ratingDistribution: Array<{ rating: number; count: number }>;
  regionSplit: Array<{ region: string; count: number }>;
  peatProfile: Array<{ tag: string; count: number }>;
  topDistilleries: Array<{ name: string; count: number }>;
  topBottlers: Array<{ name: string; count: number }>;
}

export interface PalateCard {
  title: string;
  value: string;
  supporting: string;
}

export interface PalateProfile {
  cards: PalateCard[];
  favoredFlavorTags: string[];
  favoredRegions: string[];
  favoredCaskStyles: string[];
  favoredPeatTag: string | null;
}

export interface AdvisorSuggestion {
  itemId: string;
  expressionId: string;
  title: string;
  score: number;
  rationale: string;
  supportingTags: string[];
}

export interface ComparisonColumn {
  title: string;
  expressionId?: string;
  displayName: string;
  brand?: string;
  distilleryName: string;
  bottlerName: string;
  ageStatement?: number;
  abv?: number;
  tags: string[];
  latestTasting?: TastingEntry;
}

export interface ComparisonRow {
  label: string;
  left: string;
  right: string;
}

export interface ComparisonResult {
  left: ComparisonColumn;
  right: ComparisonColumn;
  rows: ComparisonRow[];
  summary: string;
  palateFit: { left: string; right: string };
}

export interface WhiskyStore {
  expressions: Expression[];
  collectionItems: CollectionItem[];
  tastingEntries: TastingEntry[];
  itemImages: ItemImage[];
  drafts: IntakeDraft[];
}
```

- [ ] **Step 2: Run type check — expect many errors (that's correct at this stage)**

```bash
npx tsc --noEmit 2>&1 | head -60
```

Expected: many errors across repository, analytics, advisor, profile, comparison, components. This is the starting baseline.

- [ ] **Step 3: Commit the type skeleton**

```bash
git add lib/types.ts
git commit -m "refactor: simplify types — flat Expression with tags, drop Distillery/Bottler/Citation/PriceSnapshot"
```

---

## Task 2: Simplify the Zod schema

**Files:**
- Modify: `lib/schemas.ts`

- [ ] **Step 1: Replace `lib/schemas.ts`**

```typescript
// lib/schemas.ts
import { z } from "zod";

const bottleRecordSchema = z.object({
  name: z.string().min(1),
  distilleryName: z.string().optional(),
  bottlerName: z.string().optional(),
  brand: z.string().optional(),
  country: z.string().optional(),
  abv: z.number().optional(),
  ageStatement: z.number().int().positive().optional(),
  barcode: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum(["owned", "wishlist"]),
  fillState: z.enum(["sealed", "open", "finished"]),
  purchaseCurrency: z.string().min(3).max(3),
  purchasePrice: z.number().optional(),
  purchaseDate: z.string().optional(),
  purchaseSource: z.string().optional(),
  personalNotes: z.string().optional(),
  frontImageUrl: z.string().optional(),
  frontImageLabel: z.string().optional()
});

export const saveDraftSchema = bottleRecordSchema.extend({
  draftId: z.string().min(1)
});

export const updateItemSchema = bottleRecordSchema;

export const tastingSchema = z.object({
  tastedAt: z.string().min(1),
  nose: z.string().min(1),
  palate: z.string().min(1),
  finish: z.string().min(1),
  overallNote: z.string().min(1),
  rating: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5)
  ])
});

export const barcodeSchema = z.object({
  barcode: z.string().min(3)
});

export const compareSchema = z.object({
  leftId: z.string().min(1),
  rightId: z.string().min(1)
});
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit 2>&1 | grep "schemas" | head -20
```

Expected: no errors in `schemas.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add lib/schemas.ts
git commit -m "refactor: simplify bottle schema — tags array replaces all enum fields"
```

---

## Task 3: Rewrite the OpenAI intake pipeline

**Files:**
- Modify: `lib/openai.ts`

The old pipeline had two prompts (identify + enrich) with complex enum normalisation. The new pipeline uses a **single prompt** that returns flat fields plus a `tags` array. The AI decides tags freely.

- [ ] **Step 1: Replace `lib/openai.ts` entirely**

```typescript
// lib/openai.ts
import { createId } from "@/lib/id";
import type { CollectionItem, Expression, IntakeDraft } from "@/lib/types";

async function callOpenAi(prompt: string, imageBase64?: string, mimeType = "image/jpeg") {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            ...(imageBase64
              ? [{ type: "input_image", image_url: `data:${mimeType};base64,${imageBase64}` }]
              : [])
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with ${response.status}`);
  }

  return response.json();
}

function getResponseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as {
    output_text?: string;
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  };
  if (typeof p.output_text === "string") return p.output_text;
  const message = p.output?.find((item) => item.type === "message");
  return message?.content?.find((item) => item.type === "output_text")?.text ?? "";
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
    "Analyze the provided whisky bottle image and return a single JSON object.",
    "Return ONLY valid JSON — no markdown, no explanations.",
    "Source priority: 1. Visible label text  2. Packaging cues  3. Internet sources for exact variant only when highly confident.",
    "If confidence for a field is below 0.8, return null for that field.",
    "For ageStatement: return integer or null for NAS.",
    "For abv: return number if clearly visible, else null.",
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
  if (!process.env.OPENAI_API_KEY || !imageBase64) {
    return null;
  }

  const prompt = buildPrompt(fileName);
  const payload = await callOpenAi(prompt, imageBase64, mimeType);
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

- [ ] **Step 2: Run type check to see errors only in openai.ts**

```bash
npx tsc --noEmit 2>&1 | grep "openai.ts" | head -20
```

Expected: no errors in `openai.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/openai.ts
git commit -m "refactor: single-prompt AI intake returning flat fields + tags array"
```

---

## Task 4: Rewrite the repository

**Files:**
- Modify: `lib/repository.ts`

This is the largest change. Remove `ensureDistillery`, `ensureBottler`, `buildExpressionRecord`, `buildDraftView`, all pricing/citation/advisor logic that references dropped types. The repository now does direct flat upserts.

- [ ] **Step 1: Read the current repository to identify every function that references dropped types**

```bash
grep -n "distillery\|bottler\|citation\|priceSnapshot\|PriceRange\|Distillery\|Bottler\|Citation" lib/repository.ts | head -60
```

Note which functions reference these — they all need rewriting.

- [ ] **Step 2: Replace `BottleRecordPayload` type and remove `ensureDistillery`/`ensureBottler`**

Find and replace the `BottleRecordPayload` type (around line 95) with:

```typescript
type BottleRecordPayload = {
  name: string;
  distilleryName?: string;
  bottlerName?: string;
  brand?: string;
  country?: string;
  abv?: number;
  ageStatement?: number;
  barcode?: string;
  description?: string;
  tags: string[];
  status: CollectionStatus;
  fillState: FillState;
  purchaseCurrency: string;
  purchasePrice?: number;
  purchaseDate?: string;
  purchaseSource?: string;
  personalNotes?: string;
  frontImageUrl?: string;
  frontImageLabel?: string;
};
```

Delete the `ensureDistillery` function (the one that creates distillery records) and the `ensureBottler` function entirely.

- [ ] **Step 3: Rewrite `buildExpressionRecord` as a simple flat builder**

Replace `buildExpressionRecord` with:

```typescript
function buildExpressionRecord(
  expressionId: string,
  payload: BottleRecordPayload,
  baseExpression?: Expression
): Expression {
  return {
    id: expressionId,
    name: payload.name,
    distilleryName: payload.distilleryName ?? baseExpression?.distilleryName,
    bottlerName: payload.bottlerName ?? baseExpression?.bottlerName,
    brand: payload.brand ?? baseExpression?.brand,
    country: payload.country ?? baseExpression?.country,
    abv: payload.abv ?? baseExpression?.abv,
    ageStatement: payload.ageStatement ?? baseExpression?.ageStatement,
    barcode: payload.barcode ?? baseExpression?.barcode,
    description: payload.description ?? baseExpression?.description,
    imageUrl: baseExpression?.imageUrl,
    tags: payload.tags.length > 0 ? payload.tags : (baseExpression?.tags ?? [])
  };
}
```

- [ ] **Step 4: Rewrite `buildDraftView` as a simple pass-through**

Replace `buildDraftView` with:

```typescript
function buildDraftView(store: WhiskyStore, draft: IntakeDraft | null) {
  if (!draft) return null;
  return {
    draftId: draft.id,
    source: draft.source,
    barcode: draft.barcode,
    rawAiResponse: draft.rawAiResponse,
    expression: draft.expression,
    collection: {
      status: (draft.collection.status ?? "owned") as CollectionStatus,
      fillState: (draft.collection.fillState ?? "sealed") as FillState,
      purchaseCurrency: draft.collection.purchaseCurrency ?? "ZAR"
    }
  };
}
```

- [ ] **Step 5: Rewrite `saveDraftAsItem`**

Replace with a flat version that creates expression and collection_item directly without FK distillery/bottler lookups:

```typescript
export async function saveDraftAsItem(draftId: string, payload: z.infer<typeof saveDraftSchema>) {
  const store = await readStore();
  const draftIndex = store.drafts.findIndex((entry) => entry.id === draftId);

  if (draftIndex < 0) return null;

  const draft = store.drafts[draftIndex];
  const baseExpression = draft.expression.id
    ? store.expressions.find((entry) => entry.id === draft.expression.id)
    : undefined;
  const expressionId = baseExpression?.id ?? createId("expr");
  const expressionRecord = buildExpressionRecord(expressionId, payload, baseExpression);

  const expressionIndex = store.expressions.findIndex((entry) => entry.id === expressionId);
  if (expressionIndex >= 0) {
    store.expressions[expressionIndex] = expressionRecord;
  } else {
    store.expressions.unshift(expressionRecord);
  }

  const now = new Date().toISOString();
  const collectionItem: CollectionItem = {
    id: draft.collectionItemId,
    expressionId,
    status: payload.status as CollectionStatus,
    fillState: payload.fillState as FillState,
    purchasePrice: payload.purchasePrice,
    purchaseCurrency: payload.purchaseCurrency,
    purchaseDate: payload.purchaseDate,
    purchaseSource: payload.purchaseSource,
    personalNotes: payload.personalNotes,
    createdAt: now,
    updatedAt: now
  };

  store.collectionItems.unshift(collectionItem);

  if (payload.frontImageUrl) {
    store.itemImages.unshift({
      id: createId("img"),
      collectionItemId: collectionItem.id,
      kind: "front",
      url: payload.frontImageUrl,
      label: payload.frontImageLabel
    });
  }

  store.drafts.splice(draftIndex, 1);
  await writeStore(store);
  return collectionItem;
}
```

- [ ] **Step 6: Rewrite `getCollectionView` to remove distillery/bottler joins**

```typescript
export async function getCollectionView(): Promise<CollectionViewItem[]> {
  const store = await readStore();
  return store.collectionItems.map((item) => {
    const expression = store.expressions.find((e) => e.id === item.expressionId) ?? {
      id: item.expressionId,
      name: "Unknown",
      tags: []
    };
    const tastingEntries = store.tastingEntries.filter(
      (t) => t.collectionItemId === item.id
    );
    const images = store.itemImages.filter((img) => img.collectionItemId === item.id);
    const latestTasting = tastingEntries.length > 0
      ? tastingEntries.reduce((latest, t) =>
          t.tastedAt > latest.tastedAt ? t : latest
        )
      : undefined;
    return { item, expression, tastingEntries, latestTasting, images };
  });
}
```

- [ ] **Step 7: Update `createDraftFromPhoto` to use new openai return shape**

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

- [ ] **Step 8: Run type check**

```bash
npx tsc --noEmit 2>&1 | grep "repository.ts" | head -30
```

Fix any remaining errors in `repository.ts` before moving on.

- [ ] **Step 9: Commit**

```bash
git add lib/repository.ts
git commit -m "refactor: flatten repository — remove distillery/bottler FK logic, direct expression upsert"
```

---

## Task 5: Rewrite Supabase store

**Files:**
- Modify: `lib/supabase-store.ts`

- [ ] **Step 1: Replace `lib/supabase-store.ts`**

```typescript
// lib/supabase-store.ts
import { createClient } from "@supabase/supabase-js";
import type { WhiskyStore } from "@/lib/types";

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

function quoteIds(ids: string[]) {
  return ids.map((id) => `"${id.replaceAll('"', '\\"')}"`).join(",");
}

async function deleteRowsNotInIds(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  table: string,
  ids: string[]
) {
  const response =
    ids.length > 0
      ? await supabase.from(table).delete().not("id", "in", `(${quoteIds(ids)})`)
      : await supabase.from(table).delete().neq("id", "");
  if (response.error) throw response.error;
}

export function isSupabaseStoreEnabled() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function readStoreFromSupabase(): Promise<WhiskyStore> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const [expressionsRes, itemsRes, tastingsRes, imagesRes, draftsRes] = await Promise.all([
    supabase.from("expressions").select("*"),
    supabase.from("collection_items").select("*"),
    supabase.from("tasting_entries").select("*"),
    supabase.from("item_images").select("*"),
    supabase.from("intake_drafts").select("*").order("created_at", { ascending: false })
  ]);

  for (const res of [expressionsRes, itemsRes, tastingsRes, imagesRes, draftsRes]) {
    if (res.error) throw res.error;
  }

  return {
    expressions: (expressionsRes.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      distilleryName: row.distillery_name ?? undefined,
      bottlerName: row.bottler_name ?? undefined,
      brand: row.brand ?? undefined,
      country: row.country ?? undefined,
      abv: toNumber(row.abv),
      ageStatement: toNumber(row.age_statement),
      barcode: row.barcode ?? undefined,
      description: row.description ?? undefined,
      imageUrl: row.image_url ?? undefined,
      tags: Array.isArray(row.tags) ? row.tags : []
    })),
    collectionItems: (itemsRes.data ?? []).map((row) => ({
      id: row.id,
      expressionId: row.expression_id,
      status: row.status,
      fillState: row.fill_state,
      purchasePrice: toNumber(row.purchase_price),
      purchaseCurrency: row.purchase_currency,
      purchaseDate: row.purchase_date ?? undefined,
      purchaseSource: row.purchase_source ?? undefined,
      personalNotes: row.personal_notes ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })),
    tastingEntries: (tastingsRes.data ?? []).map((row) => ({
      id: row.id,
      collectionItemId: row.collection_item_id,
      tastedAt: row.tasted_at,
      nose: row.nose,
      palate: row.palate,
      finish: row.finish,
      overallNote: row.overall_note,
      rating: row.rating
    })),
    itemImages: (imagesRes.data ?? []).map((row) => ({
      id: row.id,
      collectionItemId: row.collection_item_id,
      kind: row.kind,
      url: row.url,
      label: row.label ?? undefined
    })),
    drafts: (draftsRes.data ?? []).map((row) => ({
      id: row.id,
      collectionItemId: row.collection_item_id,
      source: row.source,
      barcode: row.barcode ?? undefined,
      rawAiResponse: row.raw_ai_response ?? undefined,
      expression: row.expression ?? { name: "Unknown", tags: [] },
      collection: row.collection ?? {}
    }))
  };
}

export async function writeStoreToSupabase(store: WhiskyStore) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const expressionsUpsert = await supabase.from("expressions").upsert(
    store.expressions.map((e) => ({
      id: e.id,
      name: e.name,
      distillery_name: e.distilleryName ?? null,
      bottler_name: e.bottlerName ?? null,
      brand: e.brand ?? null,
      country: e.country ?? null,
      abv: e.abv ?? null,
      age_statement: e.ageStatement ?? null,
      barcode: e.barcode ?? null,
      description: e.description ?? null,
      image_url: e.imageUrl ?? null,
      tags: e.tags
    })),
    { onConflict: "id" }
  );
  if (expressionsUpsert.error) throw expressionsUpsert.error;

  const itemsUpsert = await supabase.from("collection_items").upsert(
    store.collectionItems.map((item) => ({
      id: item.id,
      expression_id: item.expressionId,
      status: item.status,
      fill_state: item.fillState,
      purchase_price: item.purchasePrice ?? null,
      purchase_currency: item.purchaseCurrency,
      purchase_date: item.purchaseDate ?? null,
      purchase_source: item.purchaseSource ?? null,
      personal_notes: item.personalNotes ?? null,
      created_at: item.createdAt,
      updated_at: item.updatedAt
    })),
    { onConflict: "id" }
  );
  if (itemsUpsert.error) throw itemsUpsert.error;

  const tastingsUpsert = await supabase.from("tasting_entries").upsert(
    store.tastingEntries.map((t) => ({
      id: t.id,
      collection_item_id: t.collectionItemId,
      tasted_at: t.tastedAt,
      nose: t.nose,
      palate: t.palate,
      finish: t.finish,
      overall_note: t.overallNote,
      rating: t.rating
    })),
    { onConflict: "id" }
  );
  if (tastingsUpsert.error) throw tastingsUpsert.error;

  const imagesUpsert = await supabase.from("item_images").upsert(
    store.itemImages.map((img) => ({
      id: img.id,
      collection_item_id: img.collectionItemId,
      kind: img.kind,
      url: img.url,
      label: img.label ?? null
    })),
    { onConflict: "id" }
  );
  if (imagesUpsert.error) throw imagesUpsert.error;

  const draftsUpsert = await supabase.from("intake_drafts").upsert(
    store.drafts.map((d) => ({
      id: d.id,
      collection_item_id: d.collectionItemId,
      source: d.source,
      barcode: d.barcode ?? null,
      raw_ai_response: d.rawAiResponse ?? null,
      expression: d.expression,
      collection: d.collection
    })),
    { onConflict: "id" }
  );
  if (draftsUpsert.error) throw draftsUpsert.error;

  await deleteRowsNotInIds(supabase, "intake_drafts", store.drafts.map((d) => d.id));
  await deleteRowsNotInIds(supabase, "tasting_entries", store.tastingEntries.map((t) => t.id));
  await deleteRowsNotInIds(supabase, "item_images", store.itemImages.map((img) => img.id));
  await deleteRowsNotInIds(supabase, "collection_items", store.collectionItems.map((item) => item.id));
  await deleteRowsNotInIds(supabase, "expressions", store.expressions.map((e) => e.id));
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit 2>&1 | grep "supabase-store" | head -20
```

Expected: no errors in `supabase-store.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase-store.ts
git commit -m "refactor: supabase store reads/writes 5 flat tables, no distillery/bottler/citation/price"
```

---

## Task 6: Update analytics, advisor, profile, comparison

**Files:**
- Modify: `lib/analytics.ts`
- Modify: `lib/advisor.ts`
- Modify: `lib/profile.ts`
- Modify: `lib/comparison.ts`

These files access fields that no longer exist (`distillery.name`, `bottler.name`, `peatLevel`, `caskInfluence`, `bottlerKind`, `isNas`, `isLimited`, `isChillFiltered`, `isNaturalColor`). They now read from `expression.distilleryName`, `expression.bottlerName`, and `expression.tags`.

### Tag helper to add to `lib/tags.ts` (new file)

- [ ] **Step 1: Create `lib/tags.ts`**

```typescript
// lib/tags.ts

/** Returns true if the expression's tags include the given tag */
export function hasTag(tags: string[], tag: string): boolean {
  return tags.includes(tag);
}

/** Returns tags that start with the given prefix, stripping the prefix */
export function tagsWithPrefix(tags: string[], prefix: string): string[] {
  return tags.filter((t) => t.startsWith(prefix));
}

/** Returns the first tag matching any of the given candidates, or undefined */
export function firstMatchingTag(tags: string[], candidates: string[]): string | undefined {
  return tags.find((t) => candidates.includes(t));
}

const PEAT_TAGS = ["unpeated", "peated", "heavily-peated"];
const CASK_TAGS = ["bourbon-cask", "sherry-cask", "wine-cask", "rum-cask", "virgin-oak", "refill-cask"];

export function getPeatTag(tags: string[]): string | null {
  return tags.find((t) => PEAT_TAGS.includes(t)) ?? null;
}

export function getCaskStyleTags(tags: string[]): string[] {
  return tags.filter((t) => CASK_TAGS.includes(t));
}

export function isNas(tags: string[]): boolean {
  return tags.includes("nas");
}

export function isLimited(tags: string[]): boolean {
  return tags.includes("limited");
}

export function isChillFiltered(tags: string[]): boolean {
  return tags.includes("chill-filtered");
}

export function isNaturalColour(tags: string[]): boolean {
  return tags.includes("natural-colour");
}

export function isIndependentBottler(tags: string[]): boolean {
  return tags.includes("independent-bottler");
}
```

- [ ] **Step 2: Commit the tag helper**

```bash
git add lib/tags.ts
git commit -m "feat: add tag helper utilities for querying expression tags"
```

- [ ] **Step 3: Update `lib/analytics.ts`**

Replace all `distillery.name`, `bottler.name`, `peatLevel`, `caskInfluence`, `isNas`, `isLimited`, `isChillFiltered`, `isNaturalColor` access:

```typescript
// In analytics.ts, the CollectionViewItem no longer has distillery/bottler objects.
// Replace each field reference:

// OLD: distillery.name  →  NEW: expression.distilleryName ?? "Unknown"
// OLD: bottler.name     →  NEW: expression.bottlerName ?? "Unknown"
// OLD: expression.peatLevel  →  NEW: getPeatTag(expression.tags) ?? "unknown"
// OLD: expression.isNas      →  NEW: isNas(expression.tags)
// OLD: expression.isLimited  →  NEW: isLimited(expression.tags)
// OLD: expression.isChillFiltered →  NEW: isChillFiltered(expression.tags)
// OLD: expression.isNaturalColor  →  NEW: isNaturalColour(expression.tags)

// The peatProfile array changes from PeatLevel enum values to tag strings:
// OLD: Array<{ peatLevel: PeatLevel; count: number }>
// NEW: Array<{ tag: string; count: number }>

// The topDistilleries and topBottlers arrays now use the flat name fields.
// Remove PriceSnapshot/market value section entirely (no price_snapshots table).
```

Read `lib/analytics.ts` fully, then apply the substitutions. Keep all aggregate logic — only change field access patterns and remove the `marketValue` section.

- [ ] **Step 4: Update `lib/advisor.ts`**

```typescript
// Replace in advisor.ts:
// OLD: expression.caskInfluence  →  NEW: getCaskStyleTags(expression.tags)
// OLD: expression.peatLevel      →  NEW: getPeatTag(expression.tags)
// OLD: expression.region         →  NEW: expression.country ?? ""  
//   (region no longer exists — country is the geographic anchor)
// OLD: expression.flavorTags     →  NEW: expression.tags (flavor tags are now in the main tags array)
```

Read `lib/advisor.ts` fully, then apply substitutions. The scoring logic stays the same — only field access changes.

- [ ] **Step 5: Update `lib/profile.ts`**

```typescript
// Replace in profile.ts:
// OLD: expression.flavorTags    →  NEW: expression.tags
// OLD: expression.region        →  NEW: expression.country ?? ""
// OLD: expression.caskInfluence →  NEW: getCaskStyleTags(expression.tags)
// OLD: expression.peatLevel     →  NEW: getPeatTag(expression.tags)
// OLD: PalateProfile.favoredPeatLevel (PeatLevel | null)
//   →  NEW: PalateProfile.favoredPeatTag (string | null)
```

- [ ] **Step 6: Update `lib/comparison.ts`**

```typescript
// Replace in comparison.ts:
// OLD: distillery.name    →  NEW: expression.distilleryName ?? "Unknown"
// OLD: bottler.name       →  NEW: expression.bottlerName ?? "Unknown"
// OLD: expression.releaseSeries →  NEW: expression.tags.find(t => ...)  or drop row
// OLD: expression.bottlerKind   →  NEW: isIndependentBottler(expression.tags) ? "Independent" : "Official"
// OLD: expression.caskType      →  NEW: expression.tags.filter(t => t.includes("cask")).join(", ")
// OLD: expression.caskInfluence →  NEW: getCaskStyleTags(expression.tags).join(", ")
// OLD: expression.peatLevel     →  NEW: getPeatTag(expression.tags) ?? "Unknown"
// OLD: expression.isNas         →  NEW: isNas(expression.tags)
// OLD: expression.isChillFiltered →  NEW: isChillFiltered(expression.tags)
// OLD: expression.isNaturalColor  →  NEW: isNaturalColour(expression.tags)
// OLD: expression.isLimited       →  NEW: isLimited(expression.tags)
// OLD: expression.flavorTags      →  NEW: expression.tags
// Remove priceSnapshot references (no price_snapshots table)
// ComparisonColumn: replace distillery/bottler objects with distilleryName/bottlerName strings
```

- [ ] **Step 7: Run type check across all four files**

```bash
npx tsc --noEmit 2>&1 | grep -E "analytics|advisor|profile|comparison" | head -30
```

Fix any remaining errors before committing.

- [ ] **Step 8: Commit**

```bash
git add lib/analytics.ts lib/advisor.ts lib/profile.ts lib/comparison.ts
git commit -m "refactor: update analytics/advisor/profile/comparison to use flat expression + tags"
```

---

## Task 7: Update UI components

**Files:**
- Modify: `components/collection-card.tsx`
- Modify: `components/collection-browser.tsx`
- Modify: `app/collection/[itemId]/page.tsx`
- Modify: `components/add-bottle-form.tsx`

- [ ] **Step 1: Update `components/collection-card.tsx`**

```typescript
// Replace field access:
// OLD: distillery.name  →  NEW: expression.distilleryName ?? ""
// OLD: bottler.name     →  NEW: expression.bottlerName ?? ""
// OLD: expression.peatLevel    →  NEW: getPeatTag(expression.tags)
// OLD: expression.caskInfluence →  NEW: getCaskStyleTags(expression.tags)[0]
// OLD: expression.bottlerKind  →  NEW: isIndependentBottler(expression.tags) ? "Independent" : "Official"
// OLD: expression.isLimited    →  NEW: isLimited(expression.tags)
// OLD: expression.releaseSeries →  NEW: expression.tags.find(t => t === "special-release") or drop
// Remove any priceSnapshot retail range rendering
```

- [ ] **Step 2: Update `components/collection-browser.tsx`**

```typescript
// Replace field access in search haystack:
// OLD: distillery.name  →  NEW: expression.distilleryName ?? ""
// OLD: bottler.name     →  NEW: expression.bottlerName ?? ""
// OLD: expression.peatLevel     →  NEW: getPeatTag(expression.tags) ?? ""
// OLD: expression.caskInfluence →  NEW: getCaskStyleTags(expression.tags).join(" ")
// OLD: expression.bottlerKind   →  NEW: isIndependentBottler(expression.tags) ? "independent" : ""
// OLD: expression.isNas         →  NEW: isNas(expression.tags) ? "nas" : ""
// OLD: expression.isLimited     →  NEW: isLimited(expression.tags) ? "limited" : ""
// OLD: expression.isChillFiltered →  NEW: isChillFiltered(expression.tags) ? "chill-filtered" : ""
// OLD: expression.isNaturalColor  →  NEW: isNaturalColour(expression.tags) ? "natural-colour" : ""
// OLD: expression.flavorTags      →  NEW: expression.tags.join(" ")
// OLD: expression.releaseSeries   →  NEW: expression.tags.join(" ") (already included)
// Remove: expression.region, expression.volumeMl, expression.ageStatement 
//         (keep country for geographic search)
```

- [ ] **Step 3: Update `app/collection/[itemId]/page.tsx`**

```typescript
// Replace field access:
// OLD: distillery.name  →  NEW: expression.distilleryName ?? "Unknown"
// OLD: bottler.name     →  NEW: expression.bottlerName ?? "Unknown"
// OLD: expression.region       →  drop (no longer exists)
// OLD: expression.bottlerKind  →  NEW: isIndependentBottler(expression.tags) ? "Independent" : "Official"
// OLD: expression.releaseSeries →  NEW: expression.tags.find(t => t === "special-release")
// OLD: expression.isLimited    →  NEW: isLimited(expression.tags)
// OLD: expression.caskType     →  NEW: expression.tags.filter(t => t.endsWith("-cask") || t.includes("wood")).join(", ")
// OLD: expression.caskInfluence →  NEW: getCaskStyleTags(expression.tags).join(", ")
// OLD: expression.caskNumber   →  drop (no longer in Expression — was rarely populated)
// OLD: expression.bottleNumber →  drop (no longer in Expression)
// OLD: expression.outturn      →  drop (no longer in Expression)
// OLD: expression.isChillFiltered →  NEW: isChillFiltered(expression.tags)
// OLD: expression.isNaturalColor  →  NEW: isNaturalColour(expression.tags)
// OLD: expression.flavorTags      →  NEW: expression.tags
// Remove priceSnapshot retail/auction rendering
// CollectionViewItem no longer has distillery/bottler properties — remove from destructuring
```

- [ ] **Step 4: Update `components/add-bottle-form.tsx`**

The form currently has separate fields for each enum. Replace with a simpler layout:

```typescript
// Remove these form fields entirely:
//   bottlerKind select, whiskyType select, peatLevel select, caskInfluence select,
//   isNas checkbox, isChillFiltered checkbox, isNaturalColor checkbox, isLimited checkbox,
//   releaseSeries input, caskType input, caskNumber input, bottleNumber input,
//   outturn input, vintageYear input, distilledYear input, bottledYear input,
//   volumeMl input, region input, flavorTags input (separate)

// Add a single tags input (replaces all of the above):
<div className="field full-span">
  <label htmlFor="tags">Tags</label>
  <input
    defaultValue={(draft.expression.tags ?? []).join(", ")}
    id="tags"
    name="tags"
    placeholder="single-malt, sherry-cask, peated, limited, spicy, dried-fruit"
  />
  <p className="muted">Comma-separated. AI fills these automatically — add or remove as needed.</p>
</div>

// Keep these fields (they remain as dedicated columns):
//   distilleryName, bottlerName, brand, name, country, abv, ageStatement, barcode, description

// Update DraftResponse type in the form to match new Expression shape:
type DraftResponse = {
  draftId: string;
  source: string;
  barcode?: string;
  rawAiResponse?: { identificationText?: string; enrichmentText?: string };
  expression: {
    name: string;
    distilleryName?: string;
    bottlerName?: string;
    brand?: string;
    country?: string;
    abv?: number;
    ageStatement?: number;
    barcode?: string;
    description?: string;
    tags: string[];
  };
  collection: {
    status: "owned" | "wishlist";
    fillState: "sealed" | "open" | "finished";
    purchaseCurrency: string;
  };
};

// Update handleSave payload to use tags:
tags: parseFlavorTags(formData.get("tags")),  // reuse existing parseFlavorTags helper
// Remove all the old enum/boolean fields from the payload
```

- [ ] **Step 5: Run type check across components**

```bash
npx tsc --noEmit 2>&1 | grep -E "collection-card|collection-browser|itemId|add-bottle" | head -30
```

Fix errors before committing.

- [ ] **Step 6: Commit**

```bash
git add components/collection-card.tsx components/collection-browser.tsx \
  "app/collection/[itemId]/page.tsx" components/add-bottle-form.tsx
git commit -m "refactor: update all UI components to flat expression + tags model"
```

---

## Task 8: Final type check and clean up mock store

**Files:**
- Modify: `lib/mock-store.ts` (seed data)

- [ ] **Step 1: Run full type check**

```bash
npx tsc --noEmit 2>&1
```

Expected: zero errors. Fix any remaining before proceeding.

- [ ] **Step 2: Update seed data in `lib/mock-store.ts`**

Read the current seed store to find the hardcoded sample expressions. Update them to use the new flat shape. Example:

```typescript
// OLD seed expression:
{
  id: "expr-1",
  name: "Springbank 10",
  distilleryId: "dist-1",
  bottlerId: "bot-1",
  bottlerKind: "official",
  whiskyType: "single-malt",
  country: "Scotland",
  region: "Campbeltown",
  abv: 46,
  ageStatement: 10,
  peatLevel: "medium",
  caskInfluence: "bourbon",
  isNas: false,
  isChillFiltered: false,
  isNaturalColor: true,
  isLimited: false,
  flavorTags: ["briny", "vanilla", "smoke"],
  // ...
}

// NEW seed expression:
{
  id: "expr-1",
  name: "Springbank 10",
  distilleryName: "Springbank",
  bottlerName: "Springbank",
  brand: "Springbank",
  country: "Scotland",
  abv: 46,
  ageStatement: 10,
  description: "Classic Campbeltown single malt, lightly peated, non-chill filtered.",
  tags: ["single-malt", "peated", "bourbon-cask", "natural-colour", "briny", "vanilla", "smoke", "10yo"]
}
```

Remove the `distilleries` and `bottlers` seed arrays from the store entirely.

- [ ] **Step 3: Run type check again**

```bash
npx tsc --noEmit 2>&1
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add lib/mock-store.ts
git commit -m "refactor: update seed store to flat expression + tags model"
```

---

## Task 9: Write the Supabase migration

**Files:**
- Create: `supabase/migrations/2026-04-06-simplify-schema.sql`

This migration:
1. Migrates existing data from old columns to new flat columns + tags array
2. Drops `distilleries`, `bottlers`, `citations`, `price_snapshots` tables
3. Drops old columns from `expressions`
4. Adds new columns to `expressions`
5. Simplifies `intake_drafts`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/2026-04-06-simplify-schema.sql
-- Simplify schema: flatten expressions, drop normalised entity tables,
-- replace enum/boolean fields with tags array.

-- ============================================================
-- Step 1: Add new columns to expressions
-- ============================================================
alter table expressions
  add column if not exists distillery_name text,
  add column if not exists bottler_name text,
  add column if not exists tags text[] not null default '{}';

-- ============================================================
-- Step 2: Migrate distillery_name and bottler_name from FK tables
-- ============================================================
update expressions e
set distillery_name = d.name
from distilleries d
where e.distillery_id = d.id;

update expressions e
set bottler_name = b.name
from bottlers b
where e.bottler_id = b.id;

-- ============================================================
-- Step 3: Migrate enum/boolean fields into tags array
-- ============================================================
update expressions
set tags = array_remove(
  array_cat(
    array_cat(
      array_cat(
        -- whisky type
        case whisky_type
          when 'single-malt'       then array['single-malt']
          when 'blended-malt'      then array['blended-malt']
          when 'blended-scotch'    then array['blended-scotch']
          when 'single-grain'      then array['single-grain']
          when 'world-single-malt' then array['world-single-malt']
          else '{}'::text[]
        end,
        -- peat level
        case peat_level
          when 'unpeated'       then array['unpeated']
          when 'light'          then array['peated']
          when 'medium'         then array['peated']
          when 'heavily-peated' then array['heavily-peated']
          else '{}'::text[]
        end
      ),
      array_cat(
        -- cask influence
        case cask_influence
          when 'bourbon'    then array['bourbon-cask']
          when 'sherry'     then array['sherry-cask']
          when 'wine'       then array['wine-cask']
          when 'rum'        then array['rum-cask']
          when 'virgin-oak' then array['virgin-oak']
          when 'mixed'      then array['mixed-cask']
          when 'refill'     then array['refill-cask']
          else '{}'::text[]
        end,
        -- bottler kind
        case bottler_kind
          when 'independent' then array['independent-bottler']
          else '{}'::text[]
        end
      )
    ),
    array_cat(
      -- boolean flags
      case when is_nas             then array['nas']             else '{}'::text[] end ||
      case when is_limited         then array['limited']         else '{}'::text[] end ||
      case when is_natural_color   then array['natural-colour']  else '{}'::text[] end ||
      case when is_chill_filtered  then array['chill-filtered']  else '{}'::text[] end,
      -- existing flavor_tags
      case when flavor_tags is not null then flavor_tags::text[] else '{}'::text[] end
    )
  ),
  null
);

-- ============================================================
-- Step 4: Update intake_drafts — rename raw_expression to raw_ai_response,
--         drop old columns
-- ============================================================
alter table intake_drafts
  add column if not exists raw_ai_response jsonb default '{}';

update intake_drafts
set raw_ai_response = coalesce(raw_expression, '{}')
where raw_ai_response = '{}' or raw_ai_response is null;

alter table intake_drafts
  drop column if exists raw_expression,
  drop column if exists identification,
  drop column if exists review_items,
  drop column if exists suggestions,
  drop column if exists citations;

-- ============================================================
-- Step 5: Drop old columns from expressions
-- ============================================================
alter table expressions
  drop column if exists distillery_id,
  drop column if exists bottler_id,
  drop column if exists bottler_kind,
  drop column if exists whisky_type,
  drop column if exists region,
  drop column if exists is_nas,
  drop column if exists is_chill_filtered,
  drop column if exists is_natural_color,
  drop column if exists is_limited,
  drop column if exists peat_level,
  drop column if exists cask_influence,
  drop column if exists flavor_tags,
  drop column if exists release_series,
  drop column if exists cask_type,
  drop column if exists cask_number,
  drop column if exists bottle_number,
  drop column if exists outturn,
  drop column if exists vintage_year,
  drop column if exists distilled_year,
  drop column if exists bottled_year,
  drop column if exists volume_ml;

-- ============================================================
-- Step 6: Drop normalised entity tables and unused tables
-- ============================================================
drop table if exists citations;
drop table if exists price_snapshots;
drop table if exists distilleries;
drop table if exists bottlers;
```

- [ ] **Step 2: Review the migration carefully**

Check that every column being dropped was first migrated. Verify:
- `distillery_name` populated from `distilleries.name` via FK ✓
- `bottler_name` populated from `bottlers.name` via FK ✓
- All enum/boolean fields converted to tags ✓
- `raw_ai_response` populated from `raw_expression` ✓

- [ ] **Step 3: Commit the migration**

```bash
git add "supabase/migrations/2026-04-06-simplify-schema.sql"
git commit -m "feat: migration to flatten expressions, drop distilleries/bottlers/citations/price_snapshots"
```

---

## Task 10: API route cleanup and final verification

**Files:**
- Modify: `app/api/items/intake-photo/route.ts`
- Modify: `app/api/items/intake-barcode/route.ts` (if it references old types)

- [ ] **Step 1: Update `app/api/items/intake-photo/route.ts`**

The route currently builds a fallback with `distilleryName`/`bottlerName` from the old draft view. Update to use the new flat draft shape:

```typescript
import { NextResponse } from "next/server";
import { createDraftFromPhoto, getDraftViewById } from "@/lib/repository";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      fileName?: string;
      imageBase64?: string;
      imageMimeType?: string;
    };

    if (!body.fileName) {
      return NextResponse.json(
        { error: "A file name or label description is required." },
        { status: 400 }
      );
    }

    const draft = await createDraftFromPhoto(body.fileName, body.imageBase64, body.imageMimeType);
    const view = await getDraftViewById(draft.id);
    return NextResponse.json(view ?? {
      draftId: draft.id,
      source: draft.source,
      barcode: draft.barcode,
      rawAiResponse: draft.rawAiResponse,
      expression: draft.expression,
      collection: draft.collection
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Photo intake failed." },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Check `app/api/items/intake-barcode/route.ts` for dropped field references**

```bash
grep -n "distillery\|bottler\|peatLevel\|caskInfluence\|whiskyType\|bottlerKind\|isNas\|isLimited" \
  app/api/items/intake-barcode/route.ts
```

Update any found references to use the flat model.

- [ ] **Step 3: Run full type check — must be zero errors**

```bash
npx tsc --noEmit 2>&1
```

Expected: no output (zero errors).

- [ ] **Step 4: Commit**

```bash
git add app/api/items/intake-photo/route.ts app/api/items/intake-barcode/route.ts
git commit -m "refactor: update API routes to flat draft shape"
```

- [ ] **Step 5: Push all commits**

```bash
git push
```

---

## Self-Review

### Spec coverage check

| Requirement | Covered by task |
|---|---|
| Drop `distilleries` table | Task 4, 5, 9 |
| Drop `bottlers` table | Task 4, 5, 9 |
| Drop `citations` table | Task 5, 9 |
| Drop `price_snapshots` table | Task 5, 9 |
| Flatten `distillery_name`/`bottler_name` onto `expressions` | Tasks 1, 4, 9 |
| Replace enum/boolean fields with `tags` array | Tasks 1, 2, 3, 6, 7, 9 |
| Simplify `intake_drafts` to 3 JSONB blobs | Tasks 1, 5, 9 |
| Single-prompt OpenAI pipeline | Task 3 |
| Tag helper utilities | Task 6 (step 1) |
| All analytics/advisor/profile/comparison updated | Task 6 |
| All UI components updated | Task 7 |
| Form simplified to single tags input | Task 7, step 4 |
| Zod schema simplified | Task 2 |
| Mock store seed data updated | Task 8 |
| Supabase migration with data migration | Task 9 |
| API routes updated | Task 10 |

### Notes for executor

- Tasks 1–3 can be done in sequence before fixing consuming code — expect type errors until Task 8
- The migration in Task 9 is **destructive and irreversible** — run it in a staging/dev Supabase project first
- If existing data in `expressions` is empty, skip Step 2 and 3 of Task 9 (no data to migrate)
- `lib/advisor.ts` uses `expression.region` for geographic scoring — since `region` is dropped, use `expression.country` as the fallback. Update the palate profile cards accordingly.
- The comparison feature currently renders `caskNumber`, `bottleNumber`, `outturn` — these become tag-based or are dropped from the comparison view
