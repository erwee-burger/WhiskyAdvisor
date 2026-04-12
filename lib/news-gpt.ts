// lib/news-gpt.ts

import { getServerEnv } from "@/lib/env";
import type { PalateProfile, NewsBudgetPreferences } from "@/lib/types";

// Source keys map to their canonical domain strings (used for URL validation)
export const APPROVED_SOURCE_DOMAINS: Record<string, string> = {
  whiskybrother: "whiskybrother.com",
  bottegawhiskey: "bottegawhiskey.com",
  mothercityliquor: "mothercityliquor.co.za",
  normangoodfellows: "www.ngf.co.za"
};

export const APPROVED_SOURCE_KEYS = Object.keys(APPROVED_SOURCE_DOMAINS);

const OBVIOUS_NON_WHISKY_KEYWORDS = [
  "tequila",
  "mezcal",
  "gin",
  "vodka",
  "liqueur",
  "champagne",
  "mcc",
  "vermouth",
  "aperitif",
  "grappa",
  "pisco",
  "soju",
  "sake"
];

function isObviousNonWhiskyOffer(offer: GptOffer): boolean {
  const haystack = `${offer.name} ${offer.url}`.toLowerCase();
  return OBVIOUS_NON_WHISKY_KEYWORDS.some(keyword => haystack.includes(keyword));
}

const RETAILER_HINTS: Record<string, { specials: string; newArrivals: string; extraRules?: string[] }> = {
  whiskybrother: {
    specials: "Use https://www.whiskybrother.com/collections/whisky-specials and list all in-stock whiskies currently shown on that page",
    newArrivals: "Use https://www.whiskybrother.com/collections/new-whisky-arrivals and return the first 10 in-stock whiskies shown on that page",
    extraRules: [
      "For specials, use https://www.whiskybrother.com/collections/whisky-specials as the source of truth and include every in-stock whisky on that page.",
      "For new arrivals, use https://www.whiskybrother.com/collections/new-whisky-arrivals as the source of truth.",
      "For new arrivals, return the first 10 in-stock whiskies from that page.",
      "Do not include sold-out items from either Whisky Brother page.",
      "If a sold-out item appears in the Whisky Brother new arrivals list, skip it and continue until you have 10 in-stock items if at least 10 exist."
    ]
  },
  bottegawhiskey: {
    specials: "Use https://bottegawhiskey.com/product-category/specials-sale/?orderby=date and include all in-stock whiskies shown on that page",
    newArrivals: "Use https://bottegawhiskey.com/product-category/new-arrival/?orderby=date and return the first 10 in-stock whiskies shown on that page",
    extraRules: [
      "For specials, use https://bottegawhiskey.com/product-category/specials-sale/?orderby=date as the source of truth and include every in-stock whisky on that page.",
      "For new arrivals, use https://bottegawhiskey.com/product-category/new-arrival/?orderby=date as the source of truth.",
      "For new arrivals, return the first 10 in-stock whiskies from that page.",
      "These Bottega lists can include other spirits. Include whiskies or whiskeys only, and exclude tequila, gin, rum, mezcal, cognac, wine, and any other non-whisky products.",
      "Do not include sold-out items from either Bottega page.",
      "If a sold-out or non-whisky item appears in the Bottega new arrivals list, skip it and continue until you have 10 in-stock whiskies if at least 10 exist."
    ]
  },
  mothercityliquor: {
    specials: "Use https://mothercityliquor.co.za/collections/sale?sort_by=created-descending and include the whisky specials currently shown on that page",
    newArrivals: "Use https://mothercityliquor.co.za/collections/new-whisky-arrivals?sort_by=created-descending and include the whiskies currently shown on that page",
    extraRules: [
      "For specials, use https://mothercityliquor.co.za/collections/sale?sort_by=created-descending as the source of truth.",
      "The Mother City sale page can be mixed with other spirits. Include whiskies or whiskeys only and exclude tequila, gin, rum, vodka, liqueurs, and other non-whisky products.",
      "For new arrivals, use https://mothercityliquor.co.za/collections/new-whisky-arrivals?sort_by=created-descending as the source of truth."
    ]
  },
  normangoodfellows: {
    specials: "Use https://www.ngf.co.za/promotions/ and include the whisky specials currently shown on that page",
    newArrivals: "Norman Goodfellows does not have a dedicated new arrivals page, so return newArrivals: []",
    extraRules: [
      "For specials, use https://www.ngf.co.za/promotions/ as the source of truth.",
      "Norman Goodfellows does not have a dedicated new arrivals page.",
      "Always return newArrivals: [] for source key normangoodfellows."
    ]
  }
};

export interface GptOffer {
  source: string;
  kind: "special" | "new_release";
  name: string;
  price: number;
  originalPrice?: number;
  discountPct?: number;
  url: string;
  imageUrl?: string;
  inStock: boolean;
  relevanceScore: number;
  whyItMatters: string;
  citations: string[];
}

export interface GptSummaryCardShape {
  title: string;
  subtitle?: string;
  price?: number;
  url?: string;
  whyItMatters?: string;
  source?: string;
}

export interface GptNewsResponse {
  specials: GptOffer[];
  newArrivals: GptOffer[];
  summaryCards: {
    bestValue?: GptSummaryCardShape;
    worthStretching?: GptSummaryCardShape;
    mostInteresting?: GptSummaryCardShape;
  };
}

/** Validates a single GPT-returned offer. Throws a descriptive Error on failure. */
export function validateGptOffer(raw: unknown): GptOffer {
  if (!raw || typeof raw !== "object") throw new Error("offer: must be an object");
  const o = raw as Record<string, unknown>;

  if (!APPROVED_SOURCE_KEYS.includes(String(o.source ?? ""))) {
    throw new Error(`source: "${o.source}" is not an approved retailer key`);
  }

  if (typeof o.name !== "string" || o.name.trim() === "") {
    throw new Error("name: must be a non-empty string");
  }

  if (typeof o.price !== "number" || o.price <= 0) {
    throw new Error(`price: must be a positive number, got ${o.price}`);
  }

  if (typeof o.url !== "string") {
    throw new Error("url: must be a string");
  }

  const domain = APPROVED_SOURCE_DOMAINS[String(o.source)];
  if (!o.url.includes(domain)) {
    throw new Error(`url: "${o.url}" does not belong to domain "${domain}"`);
  }

  // Reject bare domain roots - require at least one path segment beyond "/"
  try {
    const parsed = new URL(o.url);
    if (parsed.pathname === "/" || parsed.pathname === "") {
      throw new Error(`url: "${o.url}" has no product path - must point to a specific product page`);
    }
  } catch (e) {
    if ((e as Error).message.startsWith("url:")) throw e;
    throw new Error(`url: "${o.url}" is not a valid URL`);
  }

  const kindStr = String(o.kind ?? "");
  if (!["special", "new_release"].includes(kindStr)) {
    throw new Error(`kind: "${kindStr}" must be either "special" or "new_release"`);
  }

  return {
    source: String(o.source),
    kind: kindStr as "special" | "new_release",
    name: String(o.name).trim(),
    price: o.price,
    originalPrice: typeof o.originalPrice === "number" ? o.originalPrice : undefined,
    discountPct: typeof o.discountPct === "number" ? o.discountPct : undefined,
    url: String(o.url),
    imageUrl: typeof o.imageUrl === "string" ? o.imageUrl : undefined,
    inStock: Boolean(o.inStock ?? true),
    relevanceScore: typeof o.relevanceScore === "number"
      ? Math.min(100, Math.max(0, Math.round(o.relevanceScore)))
      : 50,
    whyItMatters: typeof o.whyItMatters === "string" ? o.whyItMatters : "",
    citations: Array.isArray(o.citations)
      ? (o.citations as unknown[]).filter(c => typeof c === "string") as string[]
      : []
  };
}

export function buildRetailerPrompt(source: string): string {
  const domain = APPROVED_SOURCE_DOMAINS[source];
  const hints = RETAILER_HINTS[source];

  if (!domain || !hints) {
    throw new Error(`Unknown retailer source: ${source}`);
  }

  const retailerSpecificLines = hints.extraRules ?? [];

  return [
    `You are a whisky retail intelligence agent. Search the live website: ${domain}`,
    "",
    "Find ALL current SPECIALS (discounted whiskies) and ALL NEW ARRIVALS at this retailer.",
    "",
    `SPECIALS: ${hints.specials}`,
    `NEW ARRIVALS: ${hints.newArrivals}`,
    ...retailerSpecificLines,
    "",
    "IMPORTANT RULES:",
    "- Include ALL items you find regardless of price - do not filter by price",
    `- Only include items from ${domain} - no other retailers`,
    `- Every item must have a direct product page URL on ${domain}`,
    `- Use source key: "${source}" for every item`,
    "- If you find no specials, return specials: []",
    "- If you find no new arrivals, return newArrivals: []",
    "- Do not invent items - only include things you can verify are currently listed",
    "",
    "Score each item: relevanceScore 0-100 based on whisky quality and general interest only.",
    "Write a whyItMatters sentence (1-2 sentences) about what makes this bottle notable.",
    "",
    "Return ONLY a single valid JSON object with no markdown, no explanation.",
    "Required shape:",
    JSON.stringify({
      specials: [
        {
          source,
          kind: "special",
          name: "Example 12 Year",
          price: 799,
          originalPrice: 950,
          discountPct: 16,
          url: `https://${domain}/products/example-12`,
          imageUrl: null,
          inStock: true,
          relevanceScore: 75,
          whyItMatters: "Solid sherry cask expression at a good discount.",
          citations: [`https://${domain}/products/example-12`]
        }
      ],
      newArrivals: [
        {
          source,
          kind: "new_release",
          name: "New Release Name",
          price: 1200,
          url: `https://${domain}/products/new-release`,
          imageUrl: null,
          inStock: true,
          relevanceScore: 68,
          whyItMatters: "First time this expression has appeared at this retailer.",
          citations: [`https://${domain}/products/new-release`]
        }
      ]
    }, null, 2)
  ].join("\n");
}

function buildSummaryCardsPrompt(
  offers: GptOffer[],
  profile: PalateProfile | null,
  prefs: NewsBudgetPreferences
): string {
  const offerLines = offers.map(o =>
    `- [${o.source}] ${o.name} - R${o.price} (${o.kind})`
  ).join("\n");

  const budgetLines = [
    `Normal budget cap: R${prefs.softBudgetCapZar}`,
    prefs.stretchBudgetCapZar !== null
      ? `Stretch ceiling: R${prefs.stretchBudgetCapZar}`
      : "No fixed stretch ceiling"
  ];

  const palateLines = profile
    ? [
        profile.favoredRegions.length ? `Preferred regions: ${profile.favoredRegions.join(", ")}` : null,
        profile.favoredCaskStyles.length ? `Favoured cask styles: ${profile.favoredCaskStyles.join(", ")}` : null,
        profile.favoredPeatTag ? `Peat preference: ${profile.favoredPeatTag}` : null,
        profile.favoredFlavorTags.length ? `Top flavour tags: ${profile.favoredFlavorTags.join(", ")}` : null
      ].filter(Boolean)
    : ["No palate profile - pick on general quality and value"];

  return [
    "You are a whisky advisor. From the list of current offers below, pick three summary cards.",
    "",
    "AVAILABLE OFFERS:",
    offerLines,
    "",
    "USER BUDGET:",
    ...budgetLines,
    "",
    "USER PALATE:",
    ...palateLines,
    "",
    "Pick exactly three cards:",
    "  bestValue       - best price-to-quality bottle within the normal budget cap",
    "  worthStretching - one bottle worth exceeding the normal budget cap for (must be genuinely exceptional)",
    "  mostInteresting - most unusual or noteworthy item regardless of budget",
    "",
    "Each card must reference a real item from the list above.",
    "Return ONLY valid JSON with no markdown:",
    JSON.stringify({
      summaryCards: {
        bestValue: { title: "Example 12 Year", subtitle: "16% off at Whisky Brother", price: 799, url: "https://whiskybrother.com/products/example-12", whyItMatters: "Best r/quality this week.", source: "whiskybrother" },
        worthStretching: { title: "Premium Expression", subtitle: "Limited release", price: 2200, url: "https://...", whyItMatters: "Rare cask.", source: "bottegawhiskey" },
        mostInteresting: { title: "New Distillery Release", subtitle: "New arrival", price: 1200, url: "https://...", whyItMatters: "First SA release.", source: "mothercityliquor" }
      }
    }, null, 2)
  ].join("\n");
}

function getResponsesText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as { output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> };
  if (!Array.isArray(p.output)) return "";
  for (let i = p.output.length - 1; i >= 0; i--) {
    const item = p.output[i];
    if (item.type === "message" && Array.isArray(item.content)) {
      const part = item.content.find(c => c.type === "output_text");
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

export function validateAndDedupe(
  rawSpecials: unknown[],
  rawNewArrivals: unknown[]
): { specials: GptOffer[]; newArrivals: GptOffer[]; rejectionCount: number } {
  const rejections: string[] = [];

  const validatedSpecials: GptOffer[] = [];
  for (const offer of rawSpecials) {
    try {
      validatedSpecials.push(validateGptOffer({ ...(offer as object), kind: "special" }));
    } catch (e) {
      rejections.push(`special: ${(e as Error).message}`);
    }
  }

  const validatedNewArrivals: GptOffer[] = [];
  for (const offer of rawNewArrivals) {
    try {
      validatedNewArrivals.push(validateGptOffer({ ...(offer as object), kind: "new_release" }));
    } catch (e) {
      rejections.push(`new_release: ${(e as Error).message}`);
    }
  }

  if (rejections.length > 0) {
    console.warn("[news-gpt] validation rejections:", rejections.join(" | "));
  }

  const seen = new Set<string>();
  const deduped = (arr: GptOffer[]) => arr.filter(o => {
    if (seen.has(o.url)) return false;
    seen.add(o.url);
    return true;
  });

  return {
    specials: deduped(validatedSpecials),
    newArrivals: deduped(validatedNewArrivals),
    rejectionCount: rejections.length
  };
}

export function enforceRetailerOfferRules(
  specials: GptOffer[],
  newArrivals: GptOffer[]
): { specials: GptOffer[]; newArrivals: GptOffer[] } {
  const filteredSpecials = specials.filter(offer => {
    if (offer.source === "whiskybrother" && !offer.inStock) {
      return false;
    }

    if (offer.source === "bottegawhiskey") {
      if (!offer.inStock) {
        return false;
      }

      if (isObviousNonWhiskyOffer(offer)) {
        return false;
      }
    }

    if (offer.source === "mothercityliquor" && isObviousNonWhiskyOffer(offer)) {
      return false;
    }

    return true;
  });

  let whiskyBrotherNewArrivalCount = 0;
  let bottegaNewArrivalCount = 0;
  const filteredNewArrivals = newArrivals.filter(offer => {
    if (offer.source === "whiskybrother") {
      if (!offer.inStock) {
        return false;
      }

      whiskyBrotherNewArrivalCount += 1;
      return whiskyBrotherNewArrivalCount <= 10;
    }

    if (offer.source === "bottegawhiskey") {
      if (!offer.inStock) {
        return false;
      }

      if (isObviousNonWhiskyOffer(offer)) {
        return false;
      }

      bottegaNewArrivalCount += 1;
      return bottegaNewArrivalCount <= 10;
    }

    if (offer.source === "normangoodfellows") {
      return false;
    }

    return true;
  });

  return {
    specials: filteredSpecials,
    newArrivals: filteredNewArrivals
  };
}

function extractCard(raw: unknown): GptSummaryCardShape | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;
  if (typeof c.title !== "string" || !c.title) return undefined;
  return {
    title: String(c.title),
    subtitle: typeof c.subtitle === "string" ? c.subtitle : undefined,
    price: typeof c.price === "number" ? c.price : undefined,
    url: typeof c.url === "string" ? c.url : undefined,
    whyItMatters: typeof c.whyItMatters === "string" ? c.whyItMatters : undefined,
    source: typeof c.source === "string" ? c.source : undefined
  };
}

async function discoverRetailerOffers(
  source: string,
  apiKey: string,
  model: string
): Promise<{ specials: unknown[]; newArrivals: unknown[] }> {
  try {
    console.log(`[news-gpt] discovering retailer: ${source}`);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        tools: [{ type: "web_search_preview" }],
        input: [{ role: "user", content: [{ type: "input_text", text: buildRetailerPrompt(source) }] }]
      })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.warn(`[news-gpt] ${source}: Responses API ${response.status} - skipping. ${body}`);
      return { specials: [], newArrivals: [] };
    }

    const payload = await response.json();
    const text = getResponsesText(payload);
    const raw = extractJson<Record<string, unknown>>(text);

    if (!raw) {
      console.warn(`[news-gpt] ${source}: no parseable JSON in response - skipping`);
      return { specials: [], newArrivals: [] };
    }

    return {
      specials: Array.isArray(raw.specials) ? raw.specials : [],
      newArrivals: Array.isArray(raw.newArrivals) ? raw.newArrivals : []
    };
  } catch (err) {
    console.warn(`[news-gpt] ${source}: ${err instanceof Error ? err.message : String(err)} - skipping`);
    return { specials: [], newArrivals: [] };
  }
}

async function generateSummaryCards(
  offers: GptOffer[],
  profile: PalateProfile | null,
  prefs: NewsBudgetPreferences,
  apiKey: string,
  model: string
): Promise<GptNewsResponse["summaryCards"]> {
  if (offers.length === 0) return {};

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: buildSummaryCardsPrompt(offers, profile, prefs) }]
      })
    });

    if (!response.ok) return {};

    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = payload.choices?.[0]?.message?.content ?? "";
    const raw = extractJson<Record<string, unknown>>(text);

    if (!raw?.summaryCards || typeof raw.summaryCards !== "object") return {};

    const cards = raw.summaryCards as Record<string, unknown>;
    return {
      bestValue: extractCard(cards.bestValue),
      worthStretching: extractCard(cards.worthStretching),
      mostInteresting: extractCard(cards.mostInteresting)
    };
  } catch {
    return {};
  }
}

export async function discoverNewsWithGpt(
  profile: PalateProfile | null,
  prefs: NewsBudgetPreferences
): Promise<GptNewsResponse> {
  const { OPENAI_API_KEY, OPENAI_MODEL } = getServerEnv();
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const retailerResults = await Promise.all(
    APPROVED_SOURCE_KEYS.map(source => discoverRetailerOffers(source, OPENAI_API_KEY, OPENAI_MODEL))
  );

  const allRawSpecials: unknown[] = [];
  const allRawNewArrivals: unknown[] = [];
  for (const result of retailerResults) {
    allRawSpecials.push(...result.specials);
    allRawNewArrivals.push(...result.newArrivals);
  }

  const { specials, newArrivals, rejectionCount } = validateAndDedupe(allRawSpecials, allRawNewArrivals);
  const filtered = enforceRetailerOfferRules(specials, newArrivals);

  if (rejectionCount > 0) {
    console.warn(`[news-gpt] ${rejectionCount} offers rejected during validation`);
  }
  console.log(`[news-gpt] discovered: ${filtered.specials.length} specials, ${filtered.newArrivals.length} new arrivals`);

  const summaryCards = await generateSummaryCards(
    [...filtered.specials, ...filtered.newArrivals],
    profile,
    prefs,
    OPENAI_API_KEY,
    OPENAI_MODEL
  );

  return { specials: filtered.specials, newArrivals: filtered.newArrivals, summaryCards };
}
