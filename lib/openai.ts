import { createId } from "@/lib/id";
import type {
  Citation,
  CollectionItem,
  Expression,
  IntakeRawExpression,
  IntakeReviewItem,
  IntakeDraft,
  PriceSnapshot
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
  brand?: string | null;
  name?: string | null;
  releaseSeries?: string | null;
  bottlerKind?: string | null;
  whiskyType?: string | null;
  country?: string | null;
  region?: string | null;
  abv?: number | null;
  ageStatement?: string | number | null;
  vintageYear?: number | string | null;
  distilledYear?: number | string | null;
  bottledYear?: number | string | null;
  volumeMl?: number | string | null;
  caskType?: string | null;
  caskNumber?: string | null;
  bottleNumber?: number | string | null;
  outturn?: number | string | null;
  barcode?: string | null;
  peatLevel?: string | null;
  caskInfluence?: string | null;
  isChillFiltered?: boolean | null;
  isNaturalColor?: boolean | null;
  isLimited?: boolean | null;
  isNas?: boolean | null;
  flavorTags?: string[] | null;
  description?: string | null;
};

type DraftExpression = (Partial<Expression> & Pick<Expression, "name">) & {
  distilleryName?: string;
  bottlerName?: string;
};

const BOTTLER_KIND_LOOKUP: Array<{ raw: string; mapped: Expression["bottlerKind"] }> = [
  { raw: "official", mapped: "official" },
  { raw: "official bottler", mapped: "official" },
  { raw: "official bottling", mapped: "official" },
  { raw: "ob", mapped: "official" },
  { raw: "independent", mapped: "independent" },
  { raw: "independent bottler", mapped: "independent" },
  { raw: "independent bottling", mapped: "independent" },
  { raw: "ib", mapped: "independent" }
];

const WHISKY_TYPE_LOOKUP: Array<{ raw: string; mapped: Expression["whiskyType"] }> = [
  { raw: "single malt", mapped: "single-malt" },
  { raw: "single-malt", mapped: "single-malt" },
  { raw: "blended malt", mapped: "blended-malt" },
  { raw: "blended-malt", mapped: "blended-malt" },
  { raw: "blended scotch", mapped: "blended-scotch" },
  { raw: "blended-scotch", mapped: "blended-scotch" },
  { raw: "single grain", mapped: "single-grain" },
  { raw: "single-grain", mapped: "single-grain" },
  { raw: "world single malt", mapped: "world-single-malt" },
  { raw: "world-single-malt", mapped: "world-single-malt" }
];

const PEAT_LEVEL_LOOKUP: Array<{ raw: string; mapped: Expression["peatLevel"] }> = [
  { raw: "unpeated", mapped: "unpeated" },
  { raw: "none", mapped: "unpeated" },
  { raw: "light", mapped: "light" },
  { raw: "medium", mapped: "medium" },
  { raw: "heavily peated", mapped: "heavily-peated" },
  { raw: "heavily-peated", mapped: "heavily-peated" },
  { raw: "peaty", mapped: "medium" },
  { raw: "smoky", mapped: "medium" }
];

const CASK_INFLUENCE_LOOKUP: Array<{ raw: string; mapped: Expression["caskInfluence"] }> = [
  { raw: "bourbon", mapped: "bourbon" },
  { raw: "sherry", mapped: "sherry" },
  { raw: "sherry finish", mapped: "sherry" },
  { raw: "sherry cask", mapped: "sherry" },
  { raw: "wine", mapped: "wine" },
  { raw: "rum", mapped: "rum" },
  { raw: "virgin oak", mapped: "virgin-oak" },
  { raw: "virgin-oak", mapped: "virgin-oak" },
  { raw: "mixed", mapped: "mixed" },
  { raw: "refill", mapped: "refill" }
];

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

function normalizeBoolean(value: boolean | string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "1"].includes(normalized)) {
    return true;
  }
  if (["false", "no", "0"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function normalizeFlavorTags(value: string[] | null | undefined) {
  return (value ?? [])
    .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-"))
    .filter(Boolean)
    .slice(0, 6);
}

function normalizeEnumValue<T extends string>(
  value: string | null | undefined,
  lookup: Array<{ raw: string; mapped: T }>,
  fallback?: T
) {
  if (value === null || value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  const exactMatch = lookup.find((entry) => entry.raw === normalized);

  if (exactMatch) {
    return exactMatch.mapped;
  }

  const partialMatch = lookup.find((entry) => normalized.includes(entry.raw) || entry.raw.includes(normalized));

  return partialMatch?.mapped ?? fallback;
}

function toRawExpression(payload: ExtractedBottlePayload, fileName: string): IntakeRawExpression {
  return {
    distilleryName: normalizeText(payload.distilleryName),
    bottlerName: normalizeText(payload.bottlerName),
    brand: normalizeText(payload.brand),
    name: normalizeText(payload.name) ?? fileName.replace(/\.[^.]+$/, ""),
    releaseSeries: normalizeText(payload.releaseSeries),
    bottlerKind: normalizeText(payload.bottlerKind),
    whiskyType: normalizeText(payload.whiskyType),
    country: normalizeText(payload.country),
    region: normalizeText(payload.region),
    abv: normalizeNumber(payload.abv),
    ageStatement: normalizeNumber(payload.ageStatement),
    vintageYear: normalizeNumber(payload.vintageYear),
    distilledYear: normalizeNumber(payload.distilledYear),
    bottledYear: normalizeNumber(payload.bottledYear),
    volumeMl: normalizeNumber(payload.volumeMl),
    caskType: normalizeText(payload.caskType),
    caskNumber: normalizeText(payload.caskNumber),
    bottleNumber: normalizeNumber(payload.bottleNumber),
    outturn: normalizeNumber(payload.outturn),
    barcode: normalizeText(payload.barcode),
    peatLevel: normalizeText(payload.peatLevel),
    caskInfluence: normalizeText(payload.caskInfluence),
    isChillFiltered: normalizeBoolean(payload.isChillFiltered),
    isNaturalColor: normalizeBoolean(payload.isNaturalColor),
    isLimited: normalizeBoolean(payload.isLimited),
    isNas: normalizeBoolean(payload.isNas),
    flavorTags: normalizeFlavorTags(payload.flavorTags),
    description: normalizeText(payload.description)
  };
}

function buildReviewItems(
  rawExpression: IntakeRawExpression,
  mappedExpression: DraftExpression
): IntakeReviewItem[] {
  const items: IntakeReviewItem[] = [];

  const pushItem = (
    field: keyof IntakeRawExpression,
    label: string,
    confidence: number,
    note?: string
  ) => {
    const rawValue = rawExpression[field];
    const suggestedValue =
      field === "name" ? mappedExpression.name : (mappedExpression[field as keyof Expression] as IntakeReviewItem["suggestedValue"]);
    const needsReview =
      rawValue !== undefined &&
      rawValue !== null &&
      (suggestedValue === undefined || JSON.stringify(rawValue) !== JSON.stringify(suggestedValue));

    if (needsReview) {
      items.push({
        field,
        label,
        rawValue,
        suggestedValue,
        confidence,
        needsReview,
        note
      });
    }
  };

  pushItem("brand", "Brand", 0.8);
  pushItem("name", "Bottle name", 0.94);
  pushItem("releaseSeries", "Release series", 0.88);
  pushItem("bottlerKind", "Bottler kind", 0.9, "Mapped into the app's canonical bottler kind.");
  pushItem("whiskyType", "Whisky type", 0.88, "Mapped into the app's canonical whisky type.");
  pushItem("country", "Country", 0.9);
  pushItem("region", "Region", 0.9);
  pushItem("abv", "ABV", 0.85);
  pushItem("ageStatement", "Age statement", 0.82);
  pushItem("vintageYear", "Vintage year", 0.8);
  pushItem("distilledYear", "Distilled year", 0.8);
  pushItem("bottledYear", "Bottled year", 0.8);
  pushItem("volumeMl", "Bottle size", 0.8);
  pushItem("caskType", "Cask type", 0.86);
  pushItem("caskNumber", "Cask number", 0.82);
  pushItem("bottleNumber", "Bottle number", 0.82);
  pushItem("outturn", "Outturn", 0.82);
  pushItem("barcode", "Barcode", 0.95);
  pushItem("peatLevel", "Peat level", 0.8, "Mapped into the app's canonical peat scale.");
  pushItem("caskInfluence", "Cask influence", 0.8, "Mapped into the app's canonical cask influence scale.");
  pushItem("isChillFiltered", "Chill filtered", 0.9);
  pushItem("isNaturalColor", "Natural color", 0.9);
  pushItem("isLimited", "Limited release", 0.9);
  pushItem("isNas", "NAS", 0.9);
  pushItem("description", "Description", 0.7);

  return items;
}

function normalizeAnalyzedBottle(payload: ExtractedBottlePayload, fileName: string) {
  const rawExpression = toRawExpression(payload, fileName);
  const ageStatement = rawExpression.ageStatement;
  const mappedExpression = {
    distilleryName: rawExpression.distilleryName,
    bottlerName: rawExpression.bottlerName,
    brand: rawExpression.brand,
    name: rawExpression.name,
    releaseSeries: rawExpression.releaseSeries,
    bottlerKind: normalizeEnumValue(rawExpression.bottlerKind, BOTTLER_KIND_LOOKUP),
    whiskyType: normalizeEnumValue(rawExpression.whiskyType, WHISKY_TYPE_LOOKUP),
    country: rawExpression.country,
    region: rawExpression.region,
    abv: rawExpression.abv,
    ageStatement,
    vintageYear: rawExpression.vintageYear,
    distilledYear: rawExpression.distilledYear,
    bottledYear: rawExpression.bottledYear,
    volumeMl: rawExpression.volumeMl,
    caskType: rawExpression.caskType,
    caskNumber: rawExpression.caskNumber,
    bottleNumber: rawExpression.bottleNumber,
    outturn: rawExpression.outturn,
    barcode: rawExpression.barcode,
    peatLevel: normalizeEnumValue(rawExpression.peatLevel, PEAT_LEVEL_LOOKUP),
    caskInfluence: normalizeEnumValue(rawExpression.caskInfluence, CASK_INFLUENCE_LOOKUP),
    isChillFiltered: rawExpression.isChillFiltered ?? false,
    isNaturalColor: rawExpression.isNaturalColor ?? false,
    isLimited: rawExpression.isLimited ?? false,
    isNas: rawExpression.isNas ?? ageStatement === undefined,
    flavorTags: rawExpression.flavorTags ?? [],
    description: rawExpression.description
  } satisfies DraftExpression;

  return {
    rawExpression,
    expression: mappedExpression,
    reviewItems: buildReviewItems(rawExpression, mappedExpression)
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
    "Prefer the label. Do an internet search if a field is not visible or cannot be determined with reasonable confidence, and never invent rare release details or any other details that are not confirmed by the internet or the label.",
    "Return raw values for categorical fields rather than forcing a taxonomy. For example, return the label wording you can see for bottlerKind, whiskyType, peatLevel, and caskInfluence.",
    "Keep distilleryName and bottlerName separate. For official bottlings, bottlerName is often the same house as the distillery if no separate bottler is shown. For independent bottlings, keep them distinct whenever the label indicates both.",
    "For ageStatement, return the numeric age as an integer, or null if the whisky is NAS.",
    "For bottleNumber and outturn, return integers only. If the label shows a fraction like 112/642, use 112 for bottleNumber and 642 for outturn if both are visible.",
    "For volumeMl, return the bottle size in millilitres if visible, such as 700 or 750.",
    "For the production flags, return booleans when the label clearly states them: isChillFiltered, isNaturalColor, isLimited, and isNas.",
    "For flavorTags, return up to 6 concise lowercase tags and use hyphens for multi-word tags, for example \"dark-chocolate\".",
    "Fields to extract: distilleryName, bottlerName, brand, name, releaseSeries, bottlerKind, whiskyType, country, region, abv, ageStatement, vintageYear, distilledYear, bottledYear, volumeMl, caskType, caskNumber, bottleNumber, outturn, barcode, peatLevel, caskInfluence, isChillFiltered, isNaturalColor, isLimited, isNas, flavorTags, description.",
    'Output format: {"distilleryName":null,"bottlerName":null,"brand":null,"name":null,"releaseSeries":null,"bottlerKind":null,"whiskyType":null,"country":null,"region":null,"abv":null,"ageStatement":null,"vintageYear":null,"distilledYear":null,"bottledYear":null,"volumeMl":null,"caskType":null,"caskNumber":null,"bottleNumber":null,"outturn":null,"barcode":null,"peatLevel":null,"caskInfluence":null,"isChillFiltered":null,"isNaturalColor":null,"isLimited":null,"isNas":null,"flavorTags":null,"description":null}'
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
  const rawExpression: IntakeRawExpression = {
    brand: expression.brand,
    name: expression.name,
    releaseSeries: expression.releaseSeries,
    bottlerKind: expression.bottlerKind,
    whiskyType: expression.whiskyType,
    country: expression.country,
    region: expression.region,
    abv: expression.abv,
    ageStatement: expression.ageStatement,
    vintageYear: expression.vintageYear,
    distilledYear: expression.distilledYear,
    bottledYear: expression.bottledYear,
    volumeMl: expression.volumeMl,
    caskType: expression.caskType,
    caskNumber: expression.caskNumber,
    bottleNumber: expression.bottleNumber,
    outturn: expression.outturn,
    barcode: expression.barcode ?? barcode,
    peatLevel: expression.peatLevel,
    caskInfluence: expression.caskInfluence,
    isChillFiltered: expression.isChillFiltered,
    isNaturalColor: expression.isNaturalColor,
    isLimited: expression.isLimited,
    isNas: expression.isNas,
    flavorTags: expression.flavorTags,
    description: expression.description
  };
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
  const reviewItems: IntakeReviewItem[] = [
    {
      field: "name",
      label: "Bottle name",
      rawValue: expression.name,
      suggestedValue: expression.name,
      confidence: 0.93,
      needsReview: false
    },
    {
      field: "bottlerKind",
      label: "Bottler kind",
      rawValue: expression.bottlerKind,
      suggestedValue: expression.bottlerKind,
      confidence: 0.9,
      needsReview: false
    }
  ];

  return {
    id: createId("draft"),
    collectionItemId: createId("item"),
    matchedExpressionId: expression.id,
    source,
    barcode,
    rawExpression,
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
        field: "brand",
        label: "Brand",
        value: expression.brand,
        confidence: expression.brand ? 0.8 : 0.5,
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
        field: "volumeMl",
        label: "Bottle size",
        value: expression.volumeMl,
        confidence: expression.volumeMl ? 0.76 : 0.45,
        citationIds: citations.map((citation) => citation.id)
      },
      {
        field: "bottlerKind",
        label: "Official vs independent",
        value: expression.bottlerKind,
        confidence: 0.9,
        citationIds: citations.map((citation) => citation.id)
      },
      {
        field: "isLimited",
        label: "Limited release",
        value: expression.isLimited,
        confidence: expression.isLimited ? 0.8 : 0.55,
        citationIds: citations.map((citation) => citation.id)
      }
    ],
    reviewItems,
    citations
  };
}
