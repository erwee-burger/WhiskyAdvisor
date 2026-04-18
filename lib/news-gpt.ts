// lib/news-gpt.ts

import * as cheerio from "cheerio";
import { getServerEnv } from "@/lib/env";
import type { PalateProfile, NewsBudgetPreferences } from "@/lib/types";

// Source keys map to their canonical domain strings (used for URL validation)
export const APPROVED_SOURCE_DOMAINS: Record<string, string> = {
  whiskybrother: "whiskybrother.com",
  bottegawhiskey: "bottegawhiskey.com",
  mothercityliquor: "mothercityliquor.co.za",
  whiskyemporium: "whiskyemporium.co.za",
  normangoodfellows: "www.ngf.co.za"
};

export const APPROVED_SOURCE_KEYS = Object.keys(APPROVED_SOURCE_DOMAINS);

const RETAILER_COLLECTION_URLS: Record<string, { specials: string; newArrivals: string | null }> = {
  whiskybrother: {
    specials: "https://www.whiskybrother.com/collections/whisky-specials",
    newArrivals: "https://www.whiskybrother.com/collections/new-whisky-arrivals"
  },
  bottegawhiskey: {
    specials: "https://bottegawhiskey.com/product-category/specials-sale/?orderby=date",
    newArrivals: "https://bottegawhiskey.com/product-category/new-arrival/?orderby=date"
  },
  mothercityliquor: {
    specials: "https://mothercityliquor.co.za/collections/sale?sort_by=created-descending",
    newArrivals: "https://mothercityliquor.co.za/collections/new-whisky-arrivals?sort_by=created-descending"
  },
  whiskyemporium: {
    specials: "https://whiskyemporium.co.za/shop-premium-whiskeys/?orderby=date",
    newArrivals: "https://whiskyemporium.co.za/shop-premium-whiskeys/?orderby=date"
  },
  normangoodfellows: {
    specials: "https://www.ngf.co.za/promotions/",
    newArrivals: null
  }
};

const DISCOVERY_HEADERS = {
  "user-agent": "Mozilla/5.0 (compatible; WhiskyAdvisor/1.0; +https://whiskyadvisor.local)",
  "accept-language": "en-US,en;q=0.9"
};

const OBVIOUS_NON_WHISKY_KEYWORDS = [
  "tequila",
  "mezcal",
  "gin",
  "vodka",
  "cognac",
  "armagnac",
  "brandy",
  "prosecco",
  "sparkling",
  "brut",
  "calvados",
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

function isLikelyWhiskyText(text: string): boolean {
  return /\b(whisk|whiskey|bourbon|rye|single malt|single grain|blended malt|blended whisky|scotch|irish|islay|speyside|highland|campbeltown|japanese)\b/i.test(text);
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
  whiskyemporium: {
    specials: "Whisky Emporium does not have a dedicated specials page in this feed, so return specials: []",
    newArrivals: "Use https://whiskyemporium.co.za/shop-premium-whiskeys/?orderby=date and return the first 10 in-stock whiskies shown on that page",
    extraRules: [
      "Use https://whiskyemporium.co.za/shop-premium-whiskeys/?orderby=date as the source of truth.",
      "Always return specials: [] for source key whiskyemporium.",
      "For new arrivals, return the first 10 in-stock whiskies from that page.",
      "Include whiskies or whiskeys only, and exclude other spirits or barware if they appear."
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
  kind: OfferKind;
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

export function isApprovedOfferUrl(source: string, url: string): boolean {
  const domain = APPROVED_SOURCE_DOMAINS[source];
  if (!domain) {
    return false;
  }

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const canonicalDomain = domain.toLowerCase().replace(/^www\./, "");
    return hostname === canonicalDomain || hostname === `www.${canonicalDomain}`;
  } catch {
    return false;
  }
}

export function canonicalizeRetailerProductUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    parsed.pathname = parsed.pathname.replace(/^\/collections\/[^/]+\/products\//, "/products/");
    return parsed.toString();
  } catch {
    return url;
  }
}

export function parsePriceText(text: string): number | undefined {
  const matches = [...text.matchAll(/R\s*([\d,.]+)/gi)].map(match => match[1]);
  if (matches.length === 0) {
    return undefined;
  }

  const numeric = Number(matches[matches.length - 1]?.replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : undefined;
}

function toAbsoluteProductUrl(pageUrl: string, rawUrl: string | undefined): string | undefined {
  if (!rawUrl) {
    return undefined;
  }

  try {
    return canonicalizeRetailerProductUrl(new URL(rawUrl, pageUrl).toString());
  } catch {
    return undefined;
  }
}

function normaliseImageUrl(pageUrl: string, rawUrl: string | undefined): string | undefined {
  if (!rawUrl) {
    return undefined;
  }

  const cleaned = rawUrl.trim().replace("{width}", "720");
  if (!cleaned || cleaned.startsWith("data:")) {
    return undefined;
  }

  try {
    return new URL(cleaned, pageUrl).toString();
  } catch {
    return undefined;
  }
}

function formatZar(value: number): string {
  return `R${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function computeDiscountPct(price: number, originalPrice: number | undefined): number | undefined {
  if (!originalPrice || originalPrice <= price) {
    return undefined;
  }

  return Math.max(1, Math.round(((originalPrice - price) / originalPrice) * 100));
}

function inferOfferRelevanceScore(name: string, kind: OfferKind, discountPct: number | undefined): number {
  let score = kind === "special" ? 60 : 58;

  if (discountPct) {
    score += Math.min(12, Math.round(discountPct / 3));
  }

  if (/\b(18|21|25|30|40)\s*year\b/i.test(name)) {
    score += 8;
  } else if (/\b(10|12|15|16|17)\s*year\b/i.test(name)) {
    score += 4;
  }

  if (/\b(cask strength|single cask|limited|edition|release|batch|annual)\b/i.test(name)) {
    score += 6;
  }

  if (/\b(macallan|springbank|kilkerran|octomore|laphroaig|ardbeg|lagavulin|hibiki|yamazaki|hakushu)\b/i.test(name)) {
    score += 5;
  }

  return Math.min(95, score);
}

function buildOfferWhyItMatters(
  name: string,
  kind: OfferKind,
  price: number,
  originalPrice: number | undefined,
  discountPct: number | undefined
): string {
  if (kind === "special" && originalPrice && discountPct) {
    return `${name} is listed at ${formatZar(price)}, down from ${formatZar(originalPrice)} (${discountPct}% off).`;
  }

  if (kind === "special") {
    return `${name} is currently featured on the retailer's specials page at ${formatZar(price)}.`;
  }

  if (/\b(limited|edition|release|batch|single cask|cask strength)\b/i.test(name)) {
    return `${name} has just landed on the retailer's new arrivals page and looks like a notable release.`;
  }

  return `${name} has just landed on the retailer's new arrivals page at ${formatZar(price)}.`;
}

function buildParsedOffer(input: {
  source: string;
  kind: OfferKind;
  listingUrl: string;
  name: string;
  price: number;
  originalPrice?: number;
  url: string;
  imageUrl?: string;
  inStock: boolean;
}): GptOffer {
  const discountPct = computeDiscountPct(input.price, input.originalPrice);

  return {
    source: input.source,
    kind: input.kind,
    name: input.name.trim(),
    price: input.price,
    originalPrice: input.originalPrice,
    discountPct,
    url: input.url,
    imageUrl: input.imageUrl,
    inStock: input.inStock,
    relevanceScore: inferOfferRelevanceScore(input.name, input.kind, discountPct),
    whyItMatters: buildOfferWhyItMatters(input.name, input.kind, input.price, input.originalPrice, discountPct),
    citations: [...new Set([input.listingUrl, input.url])]
  };
}

function getShopifyHandle(url: string): string | undefined {
  try {
    const match = new URL(url).pathname.match(/\/products\/([^/?#]+)/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

function isWhiskyLikeType(type: string | undefined): boolean {
  if (!type) {
    return false;
  }

  return /(whisk|bourbon|rye|scotch|single-malt|single malt|blended malt|grain)/i.test(type);
}

function hasWhiskyLikeWooCommerceCategory(classNames: string[]): boolean {
  return classNames.some(className =>
    className.startsWith("product_cat-") && /(whisk|bourbon|rye|scotch)/i.test(className)
  );
}

function extractShopifyMetaTypeByHandle(html: string): Map<string, string | undefined> {
  const match = html.match(/var meta = (\{"products":\[.*?\],"page":\{.*?\}\});/s);
  if (!match?.[1]) {
    return new Map();
  }

  try {
    const payload = JSON.parse(match[1]) as { products?: Array<{ handle?: string; type?: string }> };
    const entries = (payload.products ?? [])
      .filter(product => typeof product.handle === "string")
      .map(product => [product.handle as string, typeof product.type === "string" ? product.type : undefined] as const);
    return new Map(entries);
  } catch {
    return new Map();
  }
}

type OfferKind = "special" | "new_release";

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

  const source = String(o.source);
  const domain = APPROVED_SOURCE_DOMAINS[source];
  if (!isApprovedOfferUrl(source, o.url)) {
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
        profile.favoredFlavorTags.length ? `Top tasting notes: ${profile.favoredFlavorTags.join(", ")}` : null
      ].filter(Boolean)
    : ["No palate profile - pick on general quality and value"];

  return [
    "You are a whisky advisor for a South African collector. Prices are in ZAR (R). Standard bottle size is 750ml. Most bottles available locally are 43% ABV or above.",
    "From the list of current offers below, pick three summary cards.",
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

function extractJson<T>(text: string): T | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

export function parseWhiskyBrotherCollectionHtml(
  html: string,
  pageUrl: string,
  kind: OfferKind
): GptOffer[] {
  const $ = cheerio.load(html);

  return $(".grid-item.grid-product").toArray().flatMap(element => {
    const item = $(element);
    const name = item.find(".grid-product__title").first().text().trim();
    const url = toAbsoluteProductUrl(pageUrl, item.find("a.grid-item__link").first().attr("href"));
    const imageUrl = normaliseImageUrl(
      pageUrl,
      item.find("img").first().attr("data-src") ?? item.find("img").first().attr("src")
    );
    const price = parsePriceText(
      item.find(".grid-product__price--current .visually-hidden").first().text()
      || item.find(".grid-product__price--current").first().text()
    );
    const originalPrice = parsePriceText(
      item.find(".grid-product__price--original .visually-hidden").first().text()
      || item.find(".grid-product__price--original").first().text()
    );
    const inStock = item.find(".grid-product__tag--sold-out").length === 0;

    if (!name || !url || price === undefined) {
      return [];
    }

    return [buildParsedOffer({
      source: "whiskybrother",
      kind,
      listingUrl: pageUrl,
      name,
      price,
      originalPrice,
      url,
      imageUrl,
      inStock
    })];
  });
}

function parseWooCommerceCollectionHtml(
  html: string,
  pageUrl: string,
  source: "bottegawhiskey" | "whiskyemporium" | "normangoodfellows",
  kind: OfferKind
): GptOffer[] {
  const $ = cheerio.load(html);

  return $("li.product").toArray().flatMap(element => {
    const item = $(element);
    const classNames = (item.attr("class") ?? "").split(/\s+/).filter(Boolean);
    const name = item.find("h2.woocommerce-loop-product__title").first().text().trim();
    const url = toAbsoluteProductUrl(pageUrl, item.find("a.woocommerce-LoopProduct-link").first().attr("href"));
    const imageUrl = normaliseImageUrl(
      pageUrl,
      item.find("img").first().attr("src")
      ?? item.find("img").first().attr("data-lazy-src")
    );
    const price = parsePriceText(
      item.find("ins .woocommerce-Price-amount").last().text()
      || item.find(".price .woocommerce-Price-amount").last().text()
    );
    const originalPrice = parsePriceText(item.find("del .woocommerce-Price-amount").first().text());
    const inStock = classNames.includes("instock") && !classNames.includes("outofstock");

    if (!name || !url || price === undefined) {
      return [];
    }

    const fallbackOfferShape: GptOffer = {
      source,
      kind,
      name,
      price,
      url,
      imageUrl,
      inStock,
      relevanceScore: 50,
      whyItMatters: "",
      citations: []
    };
    const hasWhiskyCategory = hasWhiskyLikeWooCommerceCategory(classNames);
    const isWhiskyItem = hasWhiskyCategory
      || isLikelyWhiskyText(`${name} ${url}`);

    if (!isWhiskyItem || (!hasWhiskyCategory && isObviousNonWhiskyOffer(fallbackOfferShape))) {
      return [];
    }

    return [buildParsedOffer({
      source,
      kind,
      listingUrl: pageUrl,
      name,
      price,
      originalPrice,
      url,
      imageUrl,
      inStock
    })];
  });
}

export function parseBottegaCollectionHtml(
  html: string,
  pageUrl: string,
  kind: OfferKind
): GptOffer[] {
  return parseWooCommerceCollectionHtml(html, pageUrl, "bottegawhiskey", kind);
}

export function parseWhiskyEmporiumCollectionHtml(
  html: string,
  pageUrl: string,
  kind: OfferKind
): GptOffer[] {
  return parseWooCommerceCollectionHtml(html, pageUrl, "whiskyemporium", kind);
}

export function parseMotherCityCollectionHtml(
  html: string,
  pageUrl: string,
  kind: OfferKind
): GptOffer[] {
  const $ = cheerio.load(html);
  const typesByHandle = extractShopifyMetaTypeByHandle(html);
  const isSalePage = pageUrl.includes("/collections/sale");

  return $(".productitem").toArray().flatMap(element => {
    const item = $(element);
    const name = item.find(".productitem--title a").first().text().trim()
      || item.find(".visually-hidden").last().text().trim();
    const url = toAbsoluteProductUrl(pageUrl, item.find("a.productitem--image-link").first().attr("href"));
    const imageUrl = normaliseImageUrl(pageUrl, item.find("img.productitem--image-primary").first().attr("src"));
    const price = parsePriceText(
      item.find(".price__current .money, .price__current .trans-money").first().text()
    );
    const originalPrice = parsePriceText(
      item.find(".price__compare-at .money, .price__compare-at .trans-money").first().text()
    );
    const inStock = item.find(".productitem__badge--soldout").length === 0;
    const handle = url ? getShopifyHandle(url) : undefined;
    const productType = handle ? typesByHandle.get(handle) : undefined;
    const fallbackOfferShape: GptOffer = {
      source: "mothercityliquor",
      kind,
      name,
      price: price ?? 0,
      url: url ?? "",
      imageUrl,
      inStock,
      relevanceScore: 50,
      whyItMatters: "",
      citations: []
    };

    if (!name || !url || price === undefined) {
      return [];
    }

    if (isSalePage && productType && !isWhiskyLikeType(productType)) {
      return [];
    }

    if (isSalePage && !productType && isObviousNonWhiskyOffer(fallbackOfferShape)) {
      return [];
    }

    return [buildParsedOffer({
      source: "mothercityliquor",
      kind,
      listingUrl: pageUrl,
      name,
      price,
      originalPrice,
      url,
      imageUrl,
      inStock
    })];
  });
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: DISCOVERY_HEADERS,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
}

async function discoverNormanGoodfellowsSpecials(pageUrl: string): Promise<GptOffer[]> {
  const html = await fetchHtml(pageUrl);
  const $ = cheerio.load(html);

  const promoLinks = $("article.ngf-term-grid-item a.ngf-term-grid-link").toArray()
    .map(link => toAbsoluteProductUrl(pageUrl, $(link).attr("href")))
    .filter((value): value is string => Boolean(value))
    .filter(link => /(whisk|bourbon|rye)/i.test(link));
  const uniquePromoLinks = [...new Set(promoLinks)];

  if (uniquePromoLinks.length === 0) {
    return [];
  }

  const nestedPages = await Promise.all(
    uniquePromoLinks.map(async link => {
      try {
        return await fetchHtml(link);
      } catch (error) {
        console.warn(`[news-gpt] normangoodfellows: failed to read promotion detail ${link} - ${error instanceof Error ? error.message : String(error)}`);
        return "";
      }
    })
  );

  return nestedPages.flatMap((nestedHtml, index) => {
    if (!nestedHtml) {
      return [];
    }

    return parseWooCommerceCollectionHtml(
      nestedHtml,
      uniquePromoLinks[index] ?? pageUrl,
      "normangoodfellows",
      "special"
    );
  });
}

function createOfferCountMap(): Record<string, { specials: number; newArrivals: number }> {
  return Object.fromEntries(
    APPROVED_SOURCE_KEYS.map(source => [source, { specials: 0, newArrivals: 0 }])
  ) as Record<string, { specials: number; newArrivals: number }>;
}

function countOffersBySource(offers: GptOffer[]): Record<string, { specials: number; newArrivals: number }> {
  const counts = createOfferCountMap();

  for (const offer of offers) {
    if (!counts[offer.source]) {
      continue;
    }

    if (offer.kind === "special") {
      counts[offer.source].specials += 1;
    } else {
      counts[offer.source].newArrivals += 1;
    }
  }

  return counts;
}

function logOfferCounts(
  stage: string,
  counts: Record<string, { specials: number; newArrivals: number }>,
  rejectionCountsBySource?: Record<string, number>
) {
  for (const source of APPROVED_SOURCE_KEYS) {
    const rejections = rejectionCountsBySource?.[source] ?? 0;
    const rejectionSuffix = rejections > 0 ? `, ${rejections} rejected` : "";
    console.log(
      `[news-gpt] ${stage} ${source}: ${counts[source].specials} specials, ${counts[source].newArrivals} new arrivals${rejectionSuffix}`
    );
  }
}

export function validateAndDedupe(
  rawSpecials: unknown[],
  rawNewArrivals: unknown[]
): {
  specials: GptOffer[];
  newArrivals: GptOffer[];
  rejectionCount: number;
  rejectionCountsBySource: Record<string, number>;
} {
  const rejections: string[] = [];
  const rejectionCountsBySource = Object.fromEntries(
    APPROVED_SOURCE_KEYS.map(source => [source, 0])
  ) as Record<string, number>;

  const countRejection = (offer: unknown) => {
    if (!offer || typeof offer !== "object") {
      return;
    }

    const source = String((offer as { source?: unknown }).source ?? "");
    if (source in rejectionCountsBySource) {
      rejectionCountsBySource[source] += 1;
    }
  };

  const validatedSpecials: GptOffer[] = [];
  for (const offer of rawSpecials) {
    try {
      validatedSpecials.push(validateGptOffer({ ...(offer as object), kind: "special" }));
    } catch (e) {
      countRejection(offer);
      rejections.push(`special: ${(e as Error).message}`);
    }
  }

  const validatedNewArrivals: GptOffer[] = [];
  for (const offer of rawNewArrivals) {
    try {
      validatedNewArrivals.push(validateGptOffer({ ...(offer as object), kind: "new_release" }));
    } catch (e) {
      countRejection(offer);
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
    rejectionCount: rejections.length,
    rejectionCountsBySource
  };
}

export function enforceRetailerOfferRules(
  specials: GptOffer[],
  newArrivals: GptOffer[]
): { specials: GptOffer[]; newArrivals: GptOffer[] } {
  const filteredSpecials = specials.filter(offer => {
    if (offer.source === "whiskyemporium") {
      return false;
    }

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
  let whiskyEmporiumNewArrivalCount = 0;
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

    if (offer.source === "whiskyemporium") {
      if (!offer.inStock) {
        return false;
      }

      if (isObviousNonWhiskyOffer(offer)) {
        return false;
      }

      whiskyEmporiumNewArrivalCount += 1;
      return whiskyEmporiumNewArrivalCount <= 10;
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
  source: string
): Promise<{ source: string; specials: unknown[]; newArrivals: unknown[] }> {
  try {
    console.log(`[news-gpt] discovering retailer: ${source}`);
    const urls = RETAILER_COLLECTION_URLS[source];
    if (!urls) {
      throw new Error(`Unknown retailer source: ${source}`);
    }

    switch (source) {
      case "whiskybrother": {
        const [specialsHtml, newArrivalsHtml] = await Promise.all([
          fetchHtml(urls.specials),
          urls.newArrivals ? fetchHtml(urls.newArrivals) : Promise.resolve("")
        ]);

        return {
          source,
          specials: parseWhiskyBrotherCollectionHtml(specialsHtml, urls.specials, "special"),
          newArrivals: urls.newArrivals
            ? parseWhiskyBrotherCollectionHtml(newArrivalsHtml, urls.newArrivals, "new_release")
            : []
        };
      }
      case "bottegawhiskey": {
        const [specialsHtml, newArrivalsHtml] = await Promise.all([
          fetchHtml(urls.specials),
          urls.newArrivals ? fetchHtml(urls.newArrivals) : Promise.resolve("")
        ]);

        return {
          source,
          specials: parseBottegaCollectionHtml(specialsHtml, urls.specials, "special"),
          newArrivals: urls.newArrivals
            ? parseBottegaCollectionHtml(newArrivalsHtml, urls.newArrivals, "new_release")
            : []
        };
      }
      case "mothercityliquor": {
        const [specialsHtml, newArrivalsHtml] = await Promise.all([
          fetchHtml(urls.specials),
          urls.newArrivals ? fetchHtml(urls.newArrivals) : Promise.resolve("")
        ]);

        return {
          source,
          specials: parseMotherCityCollectionHtml(specialsHtml, urls.specials, "special"),
          newArrivals: urls.newArrivals
            ? parseMotherCityCollectionHtml(newArrivalsHtml, urls.newArrivals, "new_release")
            : []
        };
      }
      case "whiskyemporium": {
        const newArrivalsHtml = urls.newArrivals ? await fetchHtml(urls.newArrivals) : "";

        return {
          source,
          specials: [],
          newArrivals: urls.newArrivals
            ? parseWhiskyEmporiumCollectionHtml(newArrivalsHtml, urls.newArrivals, "new_release")
            : []
        };
      }
      case "normangoodfellows":
        return {
          source,
          specials: await discoverNormanGoodfellowsSpecials(urls.specials),
          newArrivals: []
        };
      default:
        return { source, specials: [], newArrivals: [] };
    }
  } catch (err) {
    console.warn(`[news-gpt] ${source}: ${err instanceof Error ? err.message : String(err)} - skipping`);
    return { source, specials: [], newArrivals: [] };
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

  const retailerResults = await Promise.all(
    APPROVED_SOURCE_KEYS.map(source => discoverRetailerOffers(source))
  );

  const rawCounts = createOfferCountMap();
  for (const result of retailerResults) {
    rawCounts[result.source] = {
      specials: result.specials.length,
      newArrivals: result.newArrivals.length
    };
  }
  logOfferCounts("raw", rawCounts);

  const allRawSpecials: unknown[] = [];
  const allRawNewArrivals: unknown[] = [];
  for (const result of retailerResults) {
    allRawSpecials.push(...result.specials);
    allRawNewArrivals.push(...result.newArrivals);
  }

  const { specials, newArrivals, rejectionCount, rejectionCountsBySource } = validateAndDedupe(
    allRawSpecials,
    allRawNewArrivals
  );
  logOfferCounts("validated", countOffersBySource([...specials, ...newArrivals]), rejectionCountsBySource);

  const filtered = enforceRetailerOfferRules(specials, newArrivals);
  logOfferCounts("filtered", countOffersBySource([...filtered.specials, ...filtered.newArrivals]));

  if (rejectionCount > 0) {
    console.warn(`[news-gpt] ${rejectionCount} offers rejected during validation`);
  }
  console.log(`[news-gpt] discovered: ${filtered.specials.length} specials, ${filtered.newArrivals.length} new arrivals`);

  const summaryCards = OPENAI_API_KEY
    ? await generateSummaryCards(
      [...filtered.specials, ...filtered.newArrivals],
      profile,
      prefs,
      OPENAI_API_KEY,
      OPENAI_MODEL
    )
    : {};

  if (!OPENAI_API_KEY) {
    console.warn("[news-gpt] OPENAI_API_KEY not configured - skipping summary cards");
  }

  return { specials: filtered.specials, newArrivals: filtered.newArrivals, summaryCards };
}
