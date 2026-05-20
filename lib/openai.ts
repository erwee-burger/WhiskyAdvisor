import { getServerEnv } from "@/lib/env";
import { createId } from "@/lib/id";
import { TagGenerator, type ExpressionFacts } from "@/lib/tag-generator";
import type { CollectionItem, Expression, IntakeDraft } from "@/lib/types";

async function chatCompletions(
  model: string,
  prompt: string,
  imageBase64?: string,
  mimeType?: string
) {
  const { OPENAI_API_KEY } = getServerEnv();
  if (!OPENAI_API_KEY) return null;

  const content: unknown[] = [{ type: "text", text: prompt }];
  if (imageBase64 && mimeType) {
    content.push({ type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content }] })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Chat Completions ${response.status}: ${body}`);
  }
  return response.json();
}

function getChatText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as { choices?: Array<{ message?: { content?: string } }> };
  const msg = p.choices?.[0]?.message;
  return typeof msg?.content === "string" ? msg.content : "";
}

function isReasoningModel(model: string) {
  return /^o\d/i.test(model);
}

async function responsesApi(prompt: string, imageBase64?: string, mimeType?: string) {
  const { OPENAI_API_KEY, OPENAI_MODEL } = getServerEnv();
  const model = process.env.OPENAI_ENRICHMENT_MODEL || OPENAI_MODEL;
  if (!OPENAI_API_KEY) return null;

  const inputContent: unknown[] = [{ type: "input_text", text: prompt }];
  if (imageBase64 && mimeType) {
    inputContent.push({ type: "input_image", image_url: `data:${mimeType};base64,${imageBase64}` });
  }

  const body: Record<string, unknown> = {
    model,
    tools: [{ type: "web_search_preview" }],
    input: [{ role: "user", content: inputContent }]
  };
  if (isReasoningModel(model)) {
    body.reasoning = { effort: "medium" };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Responses API ${response.status}: ${body}`);
  }
  return response.json();
}

function getResponsesText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as { output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> };
  if (!Array.isArray(p.output)) return "";
  for (let i = p.output.length - 1; i >= 0; i--) {
    const item = p.output[i];
    if (item.type === "message" && Array.isArray(item.content)) {
      const part = item.content.find((c) => c.type === "output_text");
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
  tastingNotes?: string[] | null;
  facts?: ExpressionFacts | null;
};

const MIN_PREFERRED_TASTING_NOTES = 8;
const MAX_TASTING_NOTES = 15;

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

function normalizeTastingNotes(notes: unknown): string[] {
  if (!Array.isArray(notes)) return [];
  return [...new Set(notes.map((note) => normalizeText(note)).filter(Boolean) as string[])].slice(0, MAX_TASTING_NOTES);
}

const BOTTLE_FIELDS = [
  "Fields:",
  "  name (string) - full product name",
  "  distilleryName (string|null) - producing distillery",
  "  bottlerName (string|null) - bottling entity if different from distillery",
  "  brand (string|null) - brand name if distinct from distillery",
  "  country (string|null)",
  "  abv (number|null)",
  "  ageStatement (integer|null)",
  "  barcode (string|null)",
  "  description (string|null) - short neutral summary of confirmed facts only",
  `  tastingNotes (string[]) - human-readable descriptor phrases such as dried fruit, orange peel, pepper, oily; prefer ${MIN_PREFERRED_TASTING_NOTES}-${MAX_TASTING_NOTES} notes when evidence supports it`,
  "  facts (object|null) - transient structural facts used to derive tags locally",
  "    whiskyType, peatLevel, caskInfluences, caskType, finishes, bottlerKind, isNas, isChillFiltered, isNaturalColor, isLimited, isCaskStrength, releaseSeries",
  "",
  'Output format: {"name":null,"distilleryName":null,"bottlerName":null,"brand":null,"country":null,"abv":null,"ageStatement":null,"barcode":null,"description":null,"tastingNotes":[],"facts":{}}'
].join("\n");

const ENRICHMENT_POLICY = [
  "Tasting-note quality matters more than brevity.",
  `Return ${MIN_PREFERRED_TASTING_NOTES}-${MAX_TASTING_NOTES} tasting notes when retailer notes, reviews, and official descriptions support them.`,
  "Prefer specific descriptors such as charred lemon, waxy malt, sooty smoke, heather honey, grilled peach, old leather, toasted almond.",
  "Avoid generic descriptors like fruit, spice, sweet, oak unless the evidence is too sparse for anything more specific.",
  "Do not return fewer than 6 tasting notes unless evidence is genuinely sparse.",
  "Use the web results to synthesize a richer sensory profile rather than copying only the top 2 or 3 repeated words.",
  "Facts should stay conservative and identity fields should only be filled when the exact bottle variant is clear."
].join("\n");

function buildImagePrompt(fileName: string): string {
  return [
    "You are a whisky bottle identification and data extraction assistant.",
    "Analyze the provided whisky bottle image. Use web search when you need to verify or fill in details not clearly visible on the label.",
    "Return a single JSON object. Return ONLY valid JSON - no markdown, no explanations.",
    "Source priority: 1. Visible label text  2. Packaging cues  3. Web search for exact variant when needed.",
    "If confidence for a field is below 0.8, return null for that field.",
    "For ageStatement: return integer or null for NAS.",
    "For abv: return number if clearly visible or confirmed via search, else null.",
    ENRICHMENT_POLICY,
    `File hint: ${fileName}`,
    "",
    BOTTLE_FIELDS
  ].join("\n");
}

function buildNameLookupPrompt(name: string): string {
  return [
    "You are a whisky bottle data extraction assistant.",
    `Look up this whisky: "${name}"`,
    "Use web search to find accurate details. Return a single JSON object.",
    "Return ONLY valid JSON - no markdown, no explanations.",
    "Only include fields you can confirm with high confidence (0.8+).",
    "For ageStatement: return integer or null for NAS.",
    ENRICHMENT_POLICY,
    "",
    BOTTLE_FIELDS
  ].join("\n");
}

function buildExpression(
  parsed: BottlePayload,
  fallbackName: string
): Partial<Expression> & Pick<Expression, "name"> {
  const abv = normalizeNumber(parsed.abv);

  return {
    name: normalizeText(parsed.name) ?? fallbackName,
    distilleryName: normalizeText(parsed.distilleryName),
    bottlerName: normalizeText(parsed.bottlerName),
    brand: normalizeText(parsed.brand),
    country: normalizeText(parsed.country),
    abv,
    ageStatement: normalizeNumber(parsed.ageStatement),
    barcode: normalizeText(parsed.barcode),
    description: normalizeText(parsed.description),
    tags: TagGenerator.generate({ facts: parsed.facts ?? undefined, abv }),
    tastingNotes: normalizeTastingNotes(parsed.tastingNotes)
  };
}

export type ScanResult = {
  name: string;
  distillery?: string;
  price?: string;
  tastingNotes: string[];
  verdict: string;
  rating?: string;
  palateMatch?: string;
};

type ScanPayload = {
  name?: unknown;
  distillery?: unknown;
  price?: unknown;
  tastingNotes?: unknown;
  verdict?: unknown;
  rating?: unknown;
  palateMatch?: unknown;
};

type PalateSummary = {
  favoredFlavorTags: string[];
  favoredRegions: string[];
  favoredCaskStyles: string[];
  favoredPeatTag: string | null;
};

function buildScanPrompt(palate: PalateSummary | null): string {
  const palateCtx = palate
    ? `User palate — favored flavors: ${palate.favoredFlavorTags.slice(0, 8).join(", ") || "unknown"}; regions: ${palate.favoredRegions.slice(0, 5).join(", ") || "unknown"}; cask styles: ${palate.favoredCaskStyles.slice(0, 5).join(", ") || "unknown"}; peat preference: ${palate.favoredPeatTag || "unknown"}`
    : null;

  return [
    "You are a quick whisky lookup assistant. The user is in a store and needs fast info.",
    "Identify the whisky bottle in the image. Use web search for current retail pricing and brief expert reviews.",
    "Return ONLY a single compact JSON object. No markdown. No explanations.",
    "",
    "Fields:",
    "  name (string) - full bottle name as on label",
    "  distillery (string|null) - producing distillery",
    "  price (string|null) - current retail price, prefer ZAR, include USD reference if known, e.g. '~R1,200 / $65'",
    "  tastingNotes (string[]) - exactly 4-5 very short descriptors, e.g. ['honey', 'dried fruit', 'gentle smoke', 'oak spice']",
    "  verdict (string) - max 2 sentences from expert consensus. Be direct and useful.",
    "  rating (string|null) - critic score if available, e.g. '92/100 (Whisky Advocate)'",
    palateCtx
      ? `  palateMatch (string) - one short phrase assessing fit against the user's palate: ${palateCtx}`
      : "  palateMatch (string|null) - null (no palate data available)",
    "",
    'Output format: {"name":"","distillery":null,"price":null,"tastingNotes":[],"verdict":"","rating":null,"palateMatch":null}'
  ].join("\n");
}

export async function quickScanBottle(
  imageBase64: string,
  mimeType: string,
  palate: PalateSummary | null
): Promise<ScanResult | null> {
  const { OPENAI_API_KEY } = getServerEnv();
  if (!OPENAI_API_KEY) return null;

  const prompt = buildScanPrompt(palate);
  let text = "";

  try {
    const payload = await responsesApi(prompt, imageBase64, mimeType);
    text = getResponsesText(payload);
  } catch {
    const { OPENAI_MODEL } = getServerEnv();
    const payload = await chatCompletions(OPENAI_MODEL, prompt, imageBase64, mimeType);
    text = getChatText(payload);
  }

  const parsed = extractJson<ScanPayload>(text);
  if (!parsed) return null;

  return {
    name: normalizeText(parsed.name) ?? "Unknown whisky",
    distillery: normalizeText(parsed.distillery),
    price: normalizeText(parsed.price),
    tastingNotes: normalizeTastingNotes(parsed.tastingNotes).slice(0, 5),
    verdict: normalizeText(parsed.verdict) ?? "",
    rating: normalizeText(parsed.rating),
    palateMatch: normalizeText(parsed.palateMatch)
  };
}

export type ScanCandidate = {
  name: string;
  distillery?: string;
  hint?: string;
};

export type TextScanResponse =
  | { type: "result"; data: ScanResult }
  | { type: "ambiguous"; question: string; candidates: ScanCandidate[] }
  | { type: "not_found"; message: string };

type CandidatePayload = {
  name?: unknown;
  distillery?: unknown;
  hint?: unknown;
};

// Phase 1: disambiguation via web search — returns candidates or a resolved name only (no full details)
function buildDisambigPrompt(query: string): string {
  return [
    `The user is looking for a whisky and typed: "${query}"`,
    "Use web search to find what whisky expressions match this query.",
    "Return ONLY a compact JSON object. No markdown. No explanations.",
    "",
    '1. If this clearly identifies ONE specific expression: {"type":"resolved","name":"Full Exact Expression Name","distillery":"Distillery Name"}',
    '2. If multiple distinct expressions match: {"type":"ambiguous","candidates":[{"name":"Full Name","distillery":"Distillery","hint":"shortest distinguishing detail e.g. Brandy Cask 46% or Cape Ruby 2022"},...]} — 2-4 real candidates only',
    '3. If nothing found: {"type":"not_found","message":"Brief helpful tip for the user"}'
  ].join("\n");
}

// Phase 2: full details via web search for a confirmed specific bottle
function buildDetailPrompt(name: string, palate: PalateSummary | null): string {
  const palateCtx = palate
    ? `User palate — favored flavors: ${palate.favoredFlavorTags.slice(0, 8).join(", ") || "unknown"}; regions: ${palate.favoredRegions.slice(0, 5).join(", ") || "unknown"}; cask styles: ${palate.favoredCaskStyles.slice(0, 5).join(", ") || "unknown"}; peat preference: ${palate.favoredPeatTag || "unknown"}`
    : null;

  return [
    `Look up this specific whisky: "${name}"`,
    "Use web search for current retail pricing and recent expert reviews.",
    "Return ONLY a compact JSON object. No markdown.",
    "",
    "Fields:",
    "  name (string) - full bottle name",
    "  distillery (string|null)",
    "  price (string|null) - prefer ZAR, include USD reference e.g. '~R1,200 / $65'",
    "  tastingNotes (string[]) - 4-5 short descriptors",
    "  verdict (string) - max 2 sentences from expert consensus",
    "  rating (string|null) - e.g. '92/100 (Whisky Advocate)'",
    palateCtx
      ? `  palateMatch (string) - one short phrase assessing fit against: ${palateCtx}`
      : "  palateMatch (string|null) - null",
    "",
    'Output: {"name":"","distillery":null,"price":null,"tastingNotes":[],"verdict":"","rating":null,"palateMatch":null}'
  ].join("\n");
}

type DisambigPayload = {
  type?: unknown;
  name?: unknown;
  distillery?: unknown;
  candidates?: unknown;
  message?: unknown;
};

export async function textScanBottle(
  query: string,
  palate: PalateSummary | null
): Promise<TextScanResponse> {
  const { OPENAI_API_KEY, OPENAI_MODEL } = getServerEnv();
  if (!OPENAI_API_KEY) return { type: "not_found", message: "AI lookup is not configured." };

  // Phase 1: disambiguation via web search — compact response (no full details yet)
  const disambigPrompt = buildDisambigPrompt(query);
  let disambigText = "";
  try {
    const payload = await responsesApi(disambigPrompt);
    disambigText = getResponsesText(payload);
  } catch {
    try {
      const payload = await chatCompletions("gpt-4o-search-preview", disambigPrompt);
      disambigText = getChatText(payload);
    } catch {
      return { type: "not_found", message: "Lookup failed. Please try again." };
    }
  }

  const disambig = extractJson<DisambigPayload>(disambigText);
  if (!disambig || typeof disambig.type !== "string") {
    return { type: "not_found", message: "Could not parse response. Try a more specific name." };
  }

  // Ambiguous or not found — return immediately without web search
  if (disambig.type === "ambiguous" && Array.isArray(disambig.candidates)) {
    const candidates = (disambig.candidates as CandidatePayload[])
      .slice(0, 4)
      .map((c) => ({
        name: normalizeText(c.name) ?? "",
        distillery: normalizeText(c.distillery),
        hint: normalizeText(c.hint)
      }))
      .filter((c) => c.name);
    return {
      type: "ambiguous",
      question: "Which expression did you mean?",
      candidates
    };
  }

  if (disambig.type === "not_found") {
    return {
      type: "not_found",
      message: typeof disambig.message === "string" ? disambig.message : "No results found. Try a more specific name."
    };
  }

  if (disambig.type !== "resolved") {
    return { type: "not_found", message: "No results found. Try a more specific name." };
  }

  // Phase 2: confirmed specific bottle — fetch full details with web search
  const resolvedName = normalizeText(disambig.name) ?? query;
  const detailPrompt = buildDetailPrompt(resolvedName, palate);
  let detailText = "";

  try {
    const payload = await responsesApi(detailPrompt);
    detailText = getResponsesText(payload);
  } catch {
    try {
      const payload = await chatCompletions(OPENAI_MODEL, detailPrompt);
      detailText = getChatText(payload);
    } catch {
      return { type: "not_found", message: "Detail lookup failed. Please try again." };
    }
  }

  const detail = extractJson<ScanPayload>(detailText);
  if (!detail) return { type: "not_found", message: "Could not retrieve details. Try again." };

  return {
    type: "result",
    data: {
      name: normalizeText(detail.name) ?? resolvedName,
      distillery: normalizeText(detail.distillery),
      price: normalizeText(detail.price),
      tastingNotes: normalizeTastingNotes(detail.tastingNotes).slice(0, 5),
      verdict: normalizeText(detail.verdict) ?? "",
      rating: normalizeText(detail.rating),
      palateMatch: normalizeText(detail.palateMatch)
    }
  };
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

  if (!OPENAI_API_KEY) {
    return null;
  }

  if (!imageBase64) {
    const prompt = buildNameLookupPrompt(fileName);
    let text = "";
    try {
      const payload = await responsesApi(prompt);
      text = getResponsesText(payload);
      console.log("[intake] text-only: responses-api succeeded");
    } catch (err) {
      console.error("[intake] text-only: responses-api failed, falling back to search-preview:", err);
      const payload = await chatCompletions("gpt-4o-search-preview", prompt);
      text = getChatText(payload);
    }
    const parsed = extractJson<BottlePayload>(text);
    if (!parsed) return null;
    return { expression: buildExpression(parsed, fileName), rawAiResponse: { enrichmentText: text } };
  }

  const prompt = buildImagePrompt(fileName);
  let text = "";
  try {
    const payload = await responsesApi(prompt, imageBase64, mimeType);
    text = getResponsesText(payload);
    console.log("[intake] vision: responses-api succeeded");
  } catch (err) {
    console.error("[intake] vision: responses-api failed, falling back to chat-completions:", err);
    const { OPENAI_MODEL } = getServerEnv();
    const payload = await chatCompletions(OPENAI_MODEL, prompt, imageBase64, mimeType);
    text = getChatText(payload);
  }

  const parsed = extractJson<BottlePayload>(text);
  if (!parsed) return null;
  return {
    expression: buildExpression(parsed, fileName.replace(/\.[^.]+$/, "")),
    rawAiResponse: { enrichmentText: text }
  };
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
