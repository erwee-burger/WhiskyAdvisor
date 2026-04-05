import { createId } from "@/lib/id";
import type { Citation, CollectionItem, Expression, IntakeDraft, PriceSnapshot } from "@/lib/types";
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

export async function analyzeBottleImage(fileName: string, imageBase64?: string) {
  if (!process.env.OPENAI_API_KEY || !imageBase64) {
    return null;
  }

  const prompt = [
    "You are helping build a whisky collection app.",
    "Read the bottle label and return JSON only.",
    "Fields: name, releaseSeries, bottlerKind, country, region, abv, ageStatement, caskType, caskNumber, bottleNumber, outturn, peatLevel, caskInfluence, flavorTags."
  ].join(" ");

  const payload = await callOpenAi(prompt, imageBase64);
  const text = getResponseText(payload);
  const parsed = extractJson<Partial<Expression>>(text);

  if (!parsed) {
    return null;
  }

  return {
    expression: {
      ...parsed,
      name: parsed.name ?? fileName.replace(/\.[^.]+$/, "")
    }
  };
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
