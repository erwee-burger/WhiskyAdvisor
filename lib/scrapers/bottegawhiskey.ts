import * as cheerio from "cheerio";
import type { NewsItem } from "@/lib/types";

const SOURCE = "bottegawhiskey";

function parsePrice(text: string): number {
  return parseFloat(text.replace(/[^0-9.]/g, "")) || 0;
}

async function fetchItems(url: string, kind: NewsItem["kind"]): Promise<NewsItem[]> {
  const html = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; WhiskyAdvisor/1.0)" }
  }).then(r => r.text());
  const $ = cheerio.load(html);
  const items: NewsItem[] = [];

  $(".product-item, .grid__item, [data-product-id]").each((_, el) => {
    const name = $(el).find(".product-item__title, .product__title, h3").first().text().trim();
    const priceText = $(el).find(".price__regular, .product__price, .price").first().text().trim();
    const originalPriceText = $(el).find(".price__compare, s").first().text().trim();
    const href = $(el).find("a").first().attr("href") ?? "";
    const imageUrl = $(el).find("img").first().attr("src") ?? undefined;

    if (!name || !priceText) return;

    const price = parsePrice(priceText);
    const originalPrice = originalPriceText ? parsePrice(originalPriceText) : undefined;
    const discountPct = originalPrice && originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : undefined;

    items.push({
      source: SOURCE,
      kind,
      name,
      price,
      originalPrice,
      discountPct,
      url: href.startsWith("http") ? href : `https://bottegawhiskey.com${href}`,
      imageUrl,
      inStock: true
    });
  });

  return items;
}

export async function scrapeBottegaWhiskey(): Promise<NewsItem[]> {
  const [specials, newArrivals] = await Promise.allSettled([
    fetchItems("https://bottegawhiskey.com/collections/specials", "special"),
    fetchItems("https://bottegawhiskey.com/collections/new-in", "new_release")
  ]);
  return [
    ...(specials.status === "fulfilled" ? specials.value : []),
    ...(newArrivals.status === "fulfilled" ? newArrivals.value : [])
  ];
}
