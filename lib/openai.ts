import { createId } from "@/lib/id";
import type {
  Citation,
  CollectionItem,
  Expression,
  IntakeDraft,
  PriceSnapshot
} from "@/lib/types";
import {
  BOTTLER_KIND_VALUES,
  CASK_INFLUENCE_VALUES,
  PEAT_LEVEL_VALUES,
  WHISKY_TYPE_VALUES
} from "@/lib/types";
import { convertToZar } from "@/lib/currency";

function getResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const maybePayload = payload as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (typeof maybePayload.output_text === "string") {
    return maybePayload.output_text;
  }

  const message = maybePayload.output?.find((item) => item.type === "message");
  const text = message?.content?.find((item) => item.type === "output_text");
  return text?.text ?? "";
}

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

async function callOpenAi(prompt: string, imageBase64?: string) {
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
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt
            },
            ...(imageBase64
              ? [
                  {
                    type: "input_image",
                    image_url: `data:image/jpeg;base64,${imageBase64}`
                  }
                ]
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

type ExtractedBottlePayload = {
  distilleryName?: string | null;
  bottlerName?: string | null;
  name?: string | null;
  releaseSeries?: string | null;
  bottlerKind?: Expression["bottlerKind"] | null;
  whiskyType?: Expression["whiskyType"] | null;
  country?: string | null;
  region?: string | null;
  abv?: number | null;
  ageStatement?: string | number | null;
  vintageYear?: number | string | null;
  distilledYear?: number | string | null;
  bottledYear?: number | string | null;
  caskType?: string | null;
  caskNumber?: string | null;
  bottleNumber?: string | number | null;
  outturn?: string | number | null;
  barcode?: string | null;
  peatLevel?: Expression["peatLevel"] | null;
  caskInfluence?: Expression["caskInfluence"] | null;
  flavorTags?: string[] | null;
  description?: string | null;
};

function normalizeText(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : undefined;
}

function normalizeNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function normalizeFlavorTags(value: string[] | null | undefined) {
  return (value ?? [])
    .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-"))
    .filter(Boolean)
    .slice(0, 6);
}

function normalizeEnumValue<T extends string>(value: T | null | undefined) {
  return value ?? undefined;
}

function normalizeAnalyzedBottle(payload: ExtractedBottlePayload, fileName: string) {
  return {
    expression: {
      distilleryName: normalizeText(payload.distilleryName),
      bottlerName: normalizeText(payload.bottlerName),
      name: normalizeText(payload.name) ?? fileName.replace(/\.[^.]+$/, ""),
      releaseSeries: normalizeText(payload.releaseSeries),
      bottlerKind: normalizeEnumValue(payload.bottlerKind),
      whiskyType: normalizeEnumValue(payload.whiskyType),
      country: normalizeText(payload.country),
      region: normalizeText(payload.region),
      abv: normalizeNumber(payload.abv),
      ageStatement: normalizeText(payload.ageStatement),
      vintageYear: normalizeNumber(payload.vintageYear),
      distilledYear: normalizeNumber(payload.distilledYear),
      bottledYear: normalizeNumber(payload.bottledYear),
      caskType: normalizeText(payload.caskType),
      caskNumber: normalizeText(payload.caskNumber),
      bottleNumber: normalizeText(payload.bottleNumber),
      outturn: normalizeText(payload.outturn),
      barcode: normalizeText(payload.barcode),
      peatLevel: normalizeEnumValue(payload.peatLevel),
      caskInfluence: normalizeEnumValue(payload.caskInfluence),
      flavorTags: normalizeFlavorTags(payload.flavorTags),
      description: normalizeText(payload.description)
    }
  };
}

export async function analyzeBottleImage(fileName: string, imageBase64?: string) {
  if (!process.env.OPENAI_API_KEY || !imageBase64) {
    return null;
  }

  const prompt = [
    "You are a whisky expert and data extraction assistant.",
    "Your task is to analyze the provided image of a whisky bottle and extract structured information for a whisky collection app.",
    "Return ONLY a valid JSON object. Do not include markdown, explanations, or extra text.",
    "If a field is not visible or cannot be determined with reasonable confidence, return null.",
    "Be conservative. Prefer the label. Use well-known product knowledge only for widely known whiskies, and never invent rare release details.",
    `Use these exact enum values where needed: bottlerKind in [${BOTTLER_KIND_VALUES.join(", ")}], whiskyType in [${WHISKY_TYPE_VALUES.join(", ")}], peatLevel in [${PEAT_LEVEL_VALUES.join(", ")}], caskInfluence in [${CASK_INFLUENCE_VALUES.join(", ")}].`,
    "Keep distilleryName and bottlerName separate. For official bottlings, bottlerName is often the same house as the distillery if no separate bottler is shown. For independent bottlings, keep them distinct whenever the label indicates both.",
    "For ageStatement, return digits only as a string, for example \"12\", not \"12 years old\".",
    "For bottleNumber and outturn, preserve the label text if present, for example \"123 of 300\" or \"1/258\".",
    "For flavorTags, return up to 6 concise lowercase tags and use hyphens for multi-word tags, for example \"dark-chocolate\".",
    "Fields to extract: distilleryName, bottlerName, name, releaseSeries, bottlerKind, whiskyType, country, region, abv, ageStatement, vintageYear, distilledYear, bottledYear, caskType, caskNumber, bottleNumber, outturn, barcode, peatLevel, caskInfluence, flavorTags, description.",
    'Output format: {"distilleryName":null,"bottlerName":null,"name":null,"releaseSeries":null,"bottlerKind":null,"whiskyType":null,"country":null,"region":null,"abv":null,"ageStatement":null,"vintageYear":null,"distilledYear":null,"bottledYear":null,"caskType":null,"caskNumber":null,"bottleNumber":null,"outturn":null,"barcode":null,"peatLevel":null,"caskInfluence":null,"flavorTags":null,"description":null}'
  ].join(" ");

  const payload = await callOpenAi(prompt, imageBase64);
  const text = getResponseText(payload);
  const parsed = extractJson<ExtractedBottlePayload>(text);

  if (!parsed) {
    return null;
  }

  return normalizeAnalyzedBottle(parsed, fileName);
}

export async function refreshPricingWithAi(expression: Expression): Promise<PriceSnapshot | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const prompt = [
    "Use current web knowledge to estimate current whisky pricing.",
    "Return JSON only with retail and auction arrays.",
    `Bottle: ${expression.name}.`,
    "Each array item must contain label, url, currency, amount, confidence."
  ].join(" ");

  const payload = await callOpenAi(prompt);
  const text = getResponseText(payload);
  const parsed = extractJson<{
    retail?: Array<{
      label: string;
      url: string;
      currency: string;
      amount: number;
      confidence: number;
    }>;
    auction?: Array<{
      label: string;
      url: string;
      currency: string;
      amount: number;
      confidence: number;
    }>;
  }>(text);

  if (!parsed) {
    return null;
  }

  const buildRange = (
    sourceKind: "retail" | "auction",
    points: Array<{
      label: string;
      url: string;
      currency: string;
      amount: number;
      confidence: number;
    }>
  ) => {
    if (points.length === 0) {
      return undefined;
    }

    const sorted = [...points].sort((left, right) => left.amount - right.amount);
    const low = sorted[0];
    const high = sorted[sorted.length - 1];

    return {
      sourceKind,
      currency: low.currency,
      low: low.amount,
      high: high.amount,
      lowZar: convertToZar(low.amount, low.currency),
      highZar: convertToZar(high.amount, high.currency),
      confidence: sorted.reduce((sum, point) => sum + point.confidence, 0) / sorted.length,
      refreshedAt: new Date().toISOString(),
      sources: sorted.map((point) => ({
        ...point,
        normalizedZar: convertToZar(point.amount, point.currency)
      }))
    };
  };

  return {
    id: createId("price"),
    expressionId: expression.id,
    refreshedAt: new Date().toISOString(),
    retail: buildRange("retail", parsed.retail ?? []),
    auction: buildRange("auction", parsed.auction ?? [])
  };
}

export function buildDraftFromMatchedExpression(
  expression: Expression,
  source: IntakeDraft["source"],
  barcode?: string
): IntakeDraft {
  const now = new Date().toISOString();
  const citations: Citation[] = [
    {
      id: createId("citation"),
      entityType: "expression",
      entityId: expression.id,
      field: "name",
      label: "Mock enrichment source",
      url: "https://example.com/mock-source",
      sourceKind: "ai",
      confidence: 0.74,
      snippet: "Fallback mock enrichment based on your label or barcode input.",
      createdAt: now
    }
  ];

  return {
    id: createId("draft"),
    collectionItemId: createId("item"),
    matchedExpressionId: expression.id,
    source,
    barcode,
    expression: {
      ...expression
    },
    collection: {
      purchaseCurrency: "ZAR",
      status: "owned",
      fillState: "sealed"
    } satisfies Partial<CollectionItem>,
    suggestions: [
      {
        field: "name",
        label: "Bottle name",
        value: expression.name,
        confidence: 0.93,
        citationIds: citations.map((citation) => citation.id)
      },
      {
        field: "releaseSeries",
        label: "Release series",
        value: expression.releaseSeries,
        confidence: expression.releaseSeries ? 0.88 : 0.5,
        citationIds: citations.map((citation) => citation.id)
      },
      {
        field: "bottlerKind",
        label: "Official vs independent",
        value: expression.bottlerKind,
        confidence: 0.9,
        citationIds: citations.map((citation) => citation.id)
      }
    ],
    citations
  };
}
