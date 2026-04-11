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
      ...(useWebSearch ? { web_search_options: {} } : {})
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("400")) throw err;
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
