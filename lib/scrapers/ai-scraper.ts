import * as cheerio from "cheerio";
import type { NewsItem } from "@/lib/types";

interface SourceConfig {
  source: string;
  baseUrl: string;
  urls: { path: string; kind: NewsItem["kind"] }[];
}

const SOURCES: SourceConfig[] = [
  {
    source: "whiskybrother",
    baseUrl: "https://whiskybrother.com",
    urls: [
      { path: "/collections/specials", kind: "special" },
      { path: "/collections/new-arrivals", kind: "new_release" }
    ]
  },
  {
    source: "bottegawhiskey",
    baseUrl: "https://bottegawhiskey.com",
    urls: [
      { path: "/collections/specials", kind: "special" },
      { path: "/collections/new-in", kind: "new_release" }
    ]
  },
  {
    source: "mothercityliquor",
    baseUrl: "https://mothercityliquor.co.za",
    urls: [
      { path: "/promotions", kind: "special" },
      { path: "/new-products", kind: "new_release" }
    ]
  },
  {
    source: "whiskyemporium",
    baseUrl: "https://whiskyemporium.co.za",
    urls: [
      { path: "/collections/specials", kind: "special" },
      { path: "/collections/new-arrivals", kind: "new_release" }
    ]
  },
  {
    source: "normangoodfellows",
    baseUrl: "https://www.ngf.co.za",
    urls: [
      { path: "/promotions", kind: "special" },
      { path: "/new-in", kind: "new_release" }
    ]
  }
];

type AiProduct = {
  name?: unknown;
  price?: unknown;
  originalPrice?: unknown;
  url?: unknown;
  imageUrl?: unknown;
  inStock?: unknown;
};

function stripHtml(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, nav, header, footer, [aria-hidden='true']").remove();
  return $.text().replace(/\s+/g, " ").trim();
}

async function callOpenAi(prompt: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) return "[]";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with ${response.status}`);
  }

  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return payload.choices?.[0]?.message?.content ?? "[]";
}

function extractJsonArray(text: string): AiProduct[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    return JSON.parse(match[0]) as AiProduct[];
  } catch {
    return [];
  }
}

function toAbsoluteUrl(url: unknown, baseUrl: string): string {
  if (typeof url !== "string" || !url) return "";
  if (url.startsWith("http")) return url;
  return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

function toNumber(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

export async function scrapeWithAI(
  pageUrl: string,
  source: string,
  kind: NewsItem["kind"]
): Promise<NewsItem[]> {
  const baseUrl = new URL(pageUrl).origin;

  const html = await fetch(pageUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; WhiskyAdvisor/1.0)" }
  }).then(r => r.text());

  const pageText = stripHtml(html).slice(0, 15000);

  const prompt = [
    "You are extracting whisky product listings from a retail page.",
    "Return ONLY a JSON array (no markdown, no explanation). Each element:",
    '{ "name": string, "price": number, "originalPrice": number|null, "url": string, "imageUrl": string|null, "inStock": boolean }',
    "Prices are in ZAR (South African Rand). Use absolute URLs where possible.",
    "If no products are found, return [].",
    `Page URL: ${pageUrl}`,
    "---",
    pageText
  ].join("\n");

  const responseText = await callOpenAi(prompt);
  const products = extractJsonArray(responseText);

  return products
    .filter(p => p.name && p.price)
    .map(p => {
      const price = toNumber(p.price) ?? 0;
      const originalPrice = toNumber(p.originalPrice);
      const discountPct =
        originalPrice && originalPrice > price
          ? Math.round(((originalPrice - price) / originalPrice) * 100)
          : undefined;
      return {
        source,
        kind,
        name: String(p.name),
        price,
        originalPrice,
        discountPct,
        url: toAbsoluteUrl(p.url, baseUrl),
        imageUrl: typeof p.imageUrl === "string" && p.imageUrl ? p.imageUrl : undefined,
        inStock: p.inStock !== false
      } satisfies NewsItem;
    })
    .filter(item => item.url);
}

export async function scrapeAllWithAI(): Promise<NewsItem[]> {
  const tasks = SOURCES.flatMap(config =>
    config.urls.map(({ path, kind }) => ({
      url: `${config.baseUrl}${path}`,
      source: config.source,
      kind
    }))
  );

  const results = await Promise.allSettled(
    tasks.map(t => scrapeWithAI(t.url, t.source, t.kind))
  );

  return results.flatMap((result, i) => {
    if (result.status === "fulfilled") return result.value;
    console.error(`[ai-scraper] failed for ${tasks[i].url}:`, result.reason);
    return [];
  });
}
