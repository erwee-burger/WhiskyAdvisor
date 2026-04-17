import { getServerEnv } from "@/lib/env";
import type { CollectionViewItem } from "@/lib/types";
import {
  areSuggestionValuesEqual,
  buildSuggestionDiff,
  type AiBottleDetailFieldId,
  type BottleDetailFormState,
  type BottleFieldSuggestionResponse,
  type BottleSuggestionCitation,
  getFieldRawValue,
  getBottleDetailFieldDefinition,
  normalizeSuggestedValue
} from "@/lib/bottle-detail";

const ZA_PRICE_DOMAINS = [
  "whiskybrother.com",
  "bottegawhiskey.com",
  "mothercityliquor.co.za",
  "whiskyemporium.co.za",
  "www.ngf.co.za"
] as const;

type SearchSource = {
  title?: string;
  url?: string;
  snippet?: string;
};

type ModelSuggestionPayload = {
  status?: string;
  suggestedValue?: unknown;
  confidence?: unknown;
  rationale?: unknown;
  citations?: Array<{
    label?: unknown;
    url?: unknown;
    snippet?: unknown;
  }>;
};

function extractJson<T>(text: string): T | null {
  const match = text.match(/\{[\s\S]*\}/);

  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.endsWith("/") && parsed.pathname !== "/"
      ? parsed.pathname.slice(0, -1)
      : parsed.pathname;
    return `${parsed.origin}${pathname}${parsed.search}`;
  } catch {
    return url.trim();
  }
}

function getResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const response = payload as {
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (!Array.isArray(response.output)) {
    return "";
  }

  for (let index = response.output.length - 1; index >= 0; index -= 1) {
    const item = response.output[index];

    if (!Array.isArray(item.content)) {
      continue;
    }

    const part = item.content.find((entry) => entry.type === "output_text");
    if (typeof part?.text === "string") {
      return part.text;
    }
  }

  return "";
}

function collectSources(node: unknown, found: SearchSource[] = []) {
  if (!node) {
    return found;
  }

  if (Array.isArray(node)) {
    for (const entry of node) {
      collectSources(entry, found);
    }
    return found;
  }

  if (typeof node !== "object") {
    return found;
  }

  const record = node as Record<string, unknown>;
  if (Array.isArray(record.sources)) {
    for (const source of record.sources) {
      if (!source || typeof source !== "object") {
        continue;
      }

      const sourceRecord = source as Record<string, unknown>;
      if (typeof sourceRecord.url === "string") {
        found.push({
          title: typeof sourceRecord.title === "string" ? sourceRecord.title : undefined,
          url: sourceRecord.url,
          snippet: typeof sourceRecord.snippet === "string" ? sourceRecord.snippet : undefined
        });
      }
    }
  }

  for (const value of Object.values(record)) {
    collectSources(value, found);
  }

  return found;
}

function normalizeConfidence(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.min(1, parsed));
}

function buildBottleContext(entry: CollectionViewItem, draftValues: BottleDetailFormState) {
  return {
    bottleName: draftValues.name || entry.expression.name,
    brand: draftValues.brand || null,
    distilleryName: draftValues.distilleryName || null,
    bottlerName: draftValues.bottlerName || null,
    country: draftValues.country || null,
    abv: draftValues.abv ? Number(draftValues.abv) : null,
    ageStatement: draftValues.ageStatement ? Number(draftValues.ageStatement) : null,
    barcode: draftValues.barcode || null,
    tags: draftValues.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    tastingNotes: draftValues.tastingNotes
      .split(",")
      .map((note) => note.trim())
      .filter(Boolean),
    description: draftValues.description || null,
    collectionStatus: draftValues.status,
    fillState: draftValues.fillState,
    purchaseCurrency: draftValues.purchaseCurrency || "ZAR",
    purchasePrice: draftValues.purchasePrice ? Number(draftValues.purchasePrice) : null,
    purchaseDate: draftValues.purchaseDate || null,
    purchaseSource: draftValues.purchaseSource || null,
    personalNotes: draftValues.personalNotes || null
  };
}

function buildFieldSpecificInstructions(field: AiBottleDetailFieldId) {
  switch (field) {
    case "tags":
      return [
        "Return tags as an array of concise lowercase hyphenated tags.",
        "Prefer structural production and search tags only.",
        "Do not include more than 12 tags."
      ].join(" ");
    case "tastingNotes":
      return "Return tasting notes as an array of concise human-readable descriptor phrases. Do not return structural tags.";
    case "description":
      return "Return a short neutral fact-based summary. Avoid hype, reviews, and speculative tasting notes.";
    case "barcode":
      return "Only suggest a barcode if you can verify the exact bottle variant. Preserve the barcode as a string.";
    case "purchasePrice":
      return [
        "This field represents a current South African market reference estimate in ZAR, not what the user historically paid.",
        "Use only South African retailer evidence.",
        "Return a single numeric price in ZAR with no currency symbol.",
        "If you cannot find credible South African retailer evidence, return no_suggestion."
      ].join(" ");
    case "abv":
      return "Return ABV as a number only when it is strongly supported for the exact bottle variant.";
    case "ageStatement":
      return "Return age statement as a number only for the exact bottle variant. Return no_suggestion if the release is NAS or uncertain.";
    default:
      return "Suggest a corrected or enriched value only if it is strongly supported by credible evidence.";
  }
}

function buildSuggestionPrompt(
  entry: CollectionViewItem,
  field: AiBottleDetailFieldId,
  draftValues: BottleDetailFormState,
  currentValue: string | number | string[] | null
) {
  const definition = getBottleDetailFieldDefinition(field);
  const context = buildBottleContext(entry, draftValues);

  return [
    "You are maintaining a whisky collection record.",
    `Target field: ${definition?.label ?? field} (${field})`,
    "Use web search to verify or improve the target field when needed.",
    "Only suggest a change when the evidence is strong and the exact bottle variant is clear.",
    "If the current value already looks correct or evidence is weak, return no_suggestion.",
    buildFieldSpecificInstructions(field),
    "",
    "Current unsaved bottle record:",
    JSON.stringify(context, null, 2),
    "",
    `Current value for ${field}: ${JSON.stringify(currentValue)}`,
    "",
    "Return only valid JSON with this exact shape:",
    '{"status":"suggestion|no_suggestion","suggestedValue":null,"confidence":0.0,"rationale":"short explanation","citations":[{"label":"source title","url":"https://...","snippet":"short supporting evidence"}]}'
  ].join("\n");
}

function toCitations(
  payload: ModelSuggestionPayload,
  sources: SearchSource[]
): BottleSuggestionCitation[] {
  const sourceMap = new Map<string, SearchSource>();
  for (const source of sources) {
    if (!source.url) {
      continue;
    }

    sourceMap.set(normalizeUrl(source.url), source);
  }

  const citations = Array.isArray(payload.citations)
    ? payload.citations
        .filter((citation) => typeof citation?.url === "string")
        .map((citation) => {
          const normalized = normalizeUrl(String(citation.url));
          const source = sourceMap.get(normalized);
          return {
            label:
              typeof citation.label === "string" && citation.label.trim().length > 0
                ? citation.label.trim()
                : source?.title ?? "Web source",
            url: String(citation.url),
            snippet:
              typeof citation.snippet === "string" && citation.snippet.trim().length > 0
                ? citation.snippet.trim()
                : source?.snippet ?? "Source consulted during web search."
          };
        })
    : [];

  const deduped = new Map<string, BottleSuggestionCitation>();
  for (const citation of citations) {
    const normalized = normalizeUrl(citation.url);

    if (sourceMap.size > 0 && !sourceMap.has(normalized)) {
      continue;
    }

    if (!deduped.has(normalized)) {
      deduped.set(normalized, citation);
    }
  }

  if (deduped.size > 0) {
    return [...deduped.values()].slice(0, 3);
  }

  return sources
    .filter((source): source is Required<Pick<SearchSource, "url">> & SearchSource => typeof source.url === "string")
    .slice(0, 3)
    .map((source) => ({
      label: source.title ?? "Web source",
      url: source.url,
      snippet: source.snippet ?? "Source consulted during web search."
    }));
}

async function searchWithResponsesApi(
  field: AiBottleDetailFieldId,
  prompt: string
) {
  const { OPENAI_API_KEY, OPENAI_MODEL } = getServerEnv();

  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI is not configured for AI field suggestions.");
  }

  const isPriceSuggestion = field === "purchasePrice";
  const tool = isPriceSuggestion
    ? {
        type: "web_search",
        filters: {
          allowed_domains: [...ZA_PRICE_DOMAINS]
        },
        user_location: {
          type: "approximate",
          country: "ZA",
          city: "Johannesburg",
          region: "Gauteng",
          timezone: "Africa/Johannesburg"
        }
      }
    : {
        type: "web_search"
      };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      reasoning: { effort: "low" },
      tools: [tool],
      tool_choice: "auto",
      include: ["web_search_call.action.sources"],
      input: prompt
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`AI suggestion failed (${response.status}): ${body}`);
  }

  return response.json();
}

export async function suggestBottleFieldUpdate(args: {
  entry: CollectionViewItem;
  field: AiBottleDetailFieldId;
  currentValue?: string | number | string[] | null;
  draftValues: BottleDetailFormState;
}): Promise<BottleFieldSuggestionResponse> {
  const { entry, field, draftValues } = args;
  const currentValue = args.currentValue ?? getFieldRawValue(field, draftValues);
  const prompt = buildSuggestionPrompt(entry, field, draftValues, currentValue);
  const payload = await searchWithResponsesApi(field, prompt);
  const responseText = getResponseText(payload);
  const parsed = extractJson<ModelSuggestionPayload>(responseText);

  if (!parsed) {
    throw new Error("AI suggestion response could not be parsed.");
  }

  const normalizedValue = normalizeSuggestedValue(field, parsed.suggestedValue);
  const citations = toCitations(parsed, collectSources(payload));
  const confidence = normalizeConfidence(parsed.confidence);
  const rationale =
    typeof parsed.rationale === "string" && parsed.rationale.trim().length > 0
      ? parsed.rationale.trim()
      : "No confident improvement was identified for this field.";

  if (
    parsed.status !== "suggestion" ||
    normalizedValue === null ||
    areSuggestionValuesEqual(field, currentValue, normalizedValue)
  ) {
    return {
      field,
      status: "no_suggestion",
      suggestedValue: null,
      confidence,
      rationale,
      citations,
      diff: null,
      ...(field === "purchasePrice" ? { priceContext: "za-market-reference" as const } : {})
    };
  }

  return {
    field,
    status: "suggestion",
    suggestedValue: normalizedValue,
    confidence,
    rationale,
    citations,
    diff: buildSuggestionDiff(field, currentValue, normalizedValue),
    ...(field === "purchasePrice" ? { priceContext: "za-market-reference" as const } : {})
  };
}
