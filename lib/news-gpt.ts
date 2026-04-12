// lib/news-gpt.ts

import { getServerEnv } from "@/lib/env";
import type { PalateProfile, NewsBudgetPreferences } from "@/lib/types";

// Source keys map to their canonical domain strings (used for URL validation)
export const APPROVED_SOURCE_DOMAINS: Record<string, string> = {
  whiskybrother:    "whiskybrother.com",
  bottegawhiskey:   "bottegawhiskey.com",
  mothercityliquor: "mothercityliquor.co.za",
  whiskyemporium:   "whiskyemporium.co.za",
  normangoodfellows: "www.ngf.co.za"
};

export const APPROVED_SOURCE_KEYS = Object.keys(APPROVED_SOURCE_DOMAINS);

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

  // Reject bare domain roots — require at least one path segment beyond "/"
  try {
    const parsed = new URL(o.url);
    if (parsed.pathname === "/" || parsed.pathname === "") {
      throw new Error(`url: "${o.url}" has no product path — must point to a specific product page`);
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

function buildNewsDiscoveryPrompt(
  profile: PalateProfile | null,
  prefs: NewsBudgetPreferences
): string {
  const budgetLines = [
    `Normal budget cap: R${prefs.softBudgetCapZar}`,
    prefs.stretchBudgetCapZar !== null
      ? `Stretch ceiling: R${prefs.stretchBudgetCapZar}`
      : "No fixed stretch ceiling"
  ];

  const palateLines = profile
    ? [
        profile.favoredRegions.length
          ? `Preferred regions: ${profile.favoredRegions.join(", ")}`
          : null,
        profile.favoredCaskStyles.length
          ? `Favoured cask styles: ${profile.favoredCaskStyles.join(", ")}`
          : null,
        profile.favoredPeatTag
          ? `Peat preference: ${profile.favoredPeatTag}`
          : null,
        profile.favoredFlavorTags.length
          ? `Top flavour tags: ${profile.favoredFlavorTags.join(", ")}`
          : null
      ].filter(Boolean)
    : ["No palate profile available yet — score items on general quality and value"];

  return [
    "You are a South African whisky retail intelligence agent.",
    "Search the live websites of ONLY these five approved SA retailers:",
    "  - whiskybrother.com  (source key: whiskybrother)",
    "  - bottegawhiskey.com  (source key: bottegawhiskey)",
    "  - mothercityliquor.co.za  (source key: mothercityliquor)",
    "  - whiskyemporium.co.za  (source key: whiskyemporium)",
    "  - www.ngf.co.za  (source key: normangoodfellows)",
    "",
    "Find current SPECIALS (discounted whiskies) and NEW ARRIVALS at each retailer.",
    "Only include offers that have ALL of: an approved retailer domain, a direct product URL, and a ZAR price.",
    "Keep the same bottle from different retailers as separate entries.",
    "",
    "USER BUDGET:",
    ...budgetLines,
    "",
    "USER PALATE PROFILE:",
    ...palateLines,
    "",
    "For each offer, write a 'whyItMatters' rationale (1–2 sentences) that references the user's palate or budget.",
    "Score each offer with a relevanceScore 0–100 that reflects quality, value, and palate fit.",
    "Budget should influence scoring: bottles within the normal cap score higher, all else equal.",
    "",
    "Also produce three summary cards:",
    "  bestValue       — best price-to-quality bottle currently available",
    "  worthStretching — one bottle worth exceeding the normal budget cap for",
    "  mostInteresting — most unusual or noteworthy new arrival",
    "",
    "Return ONLY a single valid JSON object with no markdown, no explanation.",
    "Required shape:",
    JSON.stringify({
      specials: [
        {
          source: "whiskybrother",
          kind: "special",
          name: "Example 12 Year",
          price: 799,
          originalPrice: 950,
          discountPct: 16,
          url: "https://whiskybrother.com/products/example-12",
          imageUrl: null,
          inStock: true,
          relevanceScore: 75,
          whyItMatters: "Solid value sherry cask within budget.",
          citations: ["https://whiskybrother.com/products/example-12"]
        }
      ],
      newArrivals: [
        {
          source: "whiskyemporium",
          kind: "new_release",
          name: "New Distillery Release",
          price: 1200,
          url: "https://www.whiskyemporium.co.za/products/new-distillery",
          imageUrl: null,
          inStock: true,
          relevanceScore: 68,
          whyItMatters: "First release from this distillery — rare on the SA market.",
          citations: ["https://www.whiskyemporium.co.za/products/new-distillery"]
        }
      ],
      summaryCards: {
        bestValue:       { title: "Example 12 Year", subtitle: "16% off at Whisky Brother", price: 799, url: "https://whiskybrother.com/products/example-12", whyItMatters: "Best r/quality this week.", source: "whiskybrother" },
        worthStretching: { title: "Premium Expression", subtitle: "Limited release at Whisky Emporium", price: 2200, url: "https://...", whyItMatters: "Rare cask, exceptional score.", source: "whiskyemporium" },
        mostInteresting: { title: "New Distillery Release", subtitle: "New arrival at Whisky Emporium", price: 1200, url: "https://...", whyItMatters: "First SA release.", source: "whiskyemporium" }
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

function validateGptNewsResponse(raw: unknown): GptNewsResponse {
  if (!raw || typeof raw !== "object") {
    throw new Error("GPT response is not an object");
  }
  const r = raw as Record<string, unknown>;

  const specials = Array.isArray(r.specials) ? r.specials : [];
  const newArrivals = Array.isArray(r.newArrivals) ? r.newArrivals : [];

  // Validate each offer; skip any that fail validation (log and continue)
  const validatedSpecials: GptOffer[] = [];
  for (const offer of specials) {
    try {
      validatedSpecials.push(validateGptOffer({ ...(offer as object), kind: "special" }));
    } catch (e) {
      console.warn("[news-gpt] skipping invalid special:", (e as Error).message, offer);
    }
  }

  const validatedNewArrivals: GptOffer[] = [];
  for (const offer of newArrivals) {
    try {
      validatedNewArrivals.push(validateGptOffer({ ...(offer as object), kind: "new_release" }));
    } catch (e) {
      console.warn("[news-gpt] skipping invalid new arrival:", (e as Error).message, offer);
    }
  }

  // De-duplicate by URL within each section
  const seen = new Set<string>();
  const deduped = (arr: GptOffer[]) => arr.filter(o => {
    if (seen.has(o.url)) return false;
    seen.add(o.url);
    return true;
  });

  const cards = (r.summaryCards && typeof r.summaryCards === "object")
    ? (r.summaryCards as Record<string, unknown>)
    : {};

  return {
    specials:     deduped(validatedSpecials),
    newArrivals:  deduped(validatedNewArrivals),
    summaryCards: {
      bestValue:       extractCard(cards.bestValue),
      worthStretching: extractCard(cards.worthStretching),
      mostInteresting: extractCard(cards.mostInteresting)
    }
  };
}

function extractCard(raw: unknown): GptSummaryCardShape | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;
  if (typeof c.title !== "string" || !c.title) return undefined;
  return {
    title:         String(c.title),
    subtitle:      typeof c.subtitle === "string" ? c.subtitle : undefined,
    price:         typeof c.price === "number" ? c.price : undefined,
    url:           typeof c.url === "string" ? c.url : undefined,
    whyItMatters:  typeof c.whyItMatters === "string" ? c.whyItMatters : undefined,
    source:        typeof c.source === "string" ? c.source : undefined
  };
}

/** Main entry point: calls GPT via Responses API and returns validated, deduplicated offers. */
export async function discoverNewsWithGpt(
  profile: PalateProfile | null,
  prefs: NewsBudgetPreferences
): Promise<GptNewsResponse> {
  const { OPENAI_API_KEY, OPENAI_MODEL } = getServerEnv();

  const prompt = buildNewsDiscoveryPrompt(profile, prefs);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      tools: [{ type: "web_search_preview" }],
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }]
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Responses API ${response.status}: ${body}`);
  }

  const payload = await response.json();
  const text = getResponsesText(payload);

  const raw = extractJson<unknown>(text);
  if (!raw) {
    throw new Error(`GPT returned no parseable JSON. Raw text length: ${text.length}`);
  }

  return validateGptNewsResponse(raw);
}
