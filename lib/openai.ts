// lib/openai.ts
import { getServerEnv } from "@/lib/env";
import { createId } from "@/lib/id";
import type { CollectionItem, Expression, IntakeDraft } from "@/lib/types";

// Chat Completions API — used for vision (image input)
async function callChatCompletions(
  prompt: string,
  imageBase64: string,
  mimeType: string
) {
  const { OPENAI_API_KEY, OPENAI_MODEL } = getServerEnv();

  if (!OPENAI_API_KEY) return null;

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
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
          ]
        }
      ]
    })
  });

  if (!response.ok) throw new Error(`OpenAI request failed with ${response.status}`);
  return response.json();
}

function getChatCompletionsText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as { choices?: Array<{ message?: { content?: string } }> };
  const message = p.choices?.[0]?.message;
  return typeof message?.content === "string" ? message.content : "";
}

// Responses API — supports web_search_preview tool natively with GPT-5.4
async function callResponsesApi(prompt: string, imageBase64?: string, mimeType?: string) {
  const { OPENAI_API_KEY, OPENAI_MODEL } = getServerEnv();

  if (!OPENAI_API_KEY) return null;

  const inputContent: unknown[] = [{ type: "input_text", text: prompt }];
  if (imageBase64 && mimeType) {
    inputContent.push({ type: "input_image", image_url: `data:${mimeType};base64,${imageBase64}` });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      tools: [{ type: "web_search_preview" }],
      input: [{ role: "user", content: inputContent }]
    })
  });

  if (!response.ok) throw new Error(`OpenAI Responses API failed with ${response.status}`);
  return response.json();
}

function getResponsesApiText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as { output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> };
  if (!Array.isArray(p.output)) return "";
  for (let i = p.output.length - 1; i >= 0; i--) {
    const item = p.output[i];
    if (item.type === "message" && Array.isArray(item.content)) {
      const textPart = item.content.find((c) => c.type === "output_text");
      if (textPart?.text) return textPart.text;
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

const BOTTLE_FIELDS = [
  "Fields:",
  "  name (string) — full product name",
  "  distilleryName (string|null) — producing distillery",
  "  bottlerName (string|null) — bottling entity if different from distillery",
  "  brand (string|null) — brand name if distinct from distillery",
  "  country (string|null)",
  "  abv (number|null)",
  "  ageStatement (integer|null)",
  "  barcode (string|null)",
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

function buildImagePrompt(fileName: string): string {
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
    BOTTLE_FIELDS
  ].join("\n");
}

function buildNameLookupPrompt(name: string): string {
  return [
    "You are a whisky bottle data extraction assistant.",
    `Look up this whisky: "${name}"`,
    "Use web search to find accurate details. Return a single JSON object.",
    "Return ONLY valid JSON — no markdown, no explanations.",
    "Only include fields you can confirm with high confidence (0.8+).",
    "For ageStatement: return integer or null for NAS.",
    "",
    BOTTLE_FIELDS
  ].join("\n");
}

function buildExpression(
  parsed: BottlePayload,
  fallbackName: string
): Partial<Expression> & Pick<Expression, "name"> {
  return {
    name: normalizeText(parsed.name) ?? fallbackName,
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

  // Text-only path: use Responses API with web_search_preview (GPT-5.4 native)
  if (!imageBase64) {
    const prompt = buildNameLookupPrompt(fileName);
    const payload = await callResponsesApi(prompt);
    const text = getResponsesApiText(payload);
    const parsed = extractJson<BottlePayload>(text);
    if (!parsed) return null;
    return { expression: buildExpression(parsed, fileName), rawAiResponse: { enrichmentText: text } };
  }

  // Vision path: Responses API supports image + web search together.
  // Fall back to Chat Completions (vision-only) if Responses API rejects the request.
  const prompt = buildImagePrompt(fileName);
  let text = "";
  try {
    const payload = await callResponsesApi(prompt, imageBase64, mimeType);
    text = getResponsesApiText(payload);
  } catch {
    const payload = await callChatCompletions(prompt, imageBase64, mimeType);
    text = getChatCompletionsText(payload);
  }

  const parsed = extractJson<BottlePayload>(text);
  if (!parsed) return null;
  return { expression: buildExpression(parsed, fileName.replace(/\.[^.]+$/, "")), rawAiResponse: { enrichmentText: text } };
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
