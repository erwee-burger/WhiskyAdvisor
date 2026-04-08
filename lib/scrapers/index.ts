import type { NewsItem } from "@/lib/types";
import { scrapeAllWithAI } from "@/lib/scrapers/ai-scraper";

type Scraper = () => Promise<NewsItem[]>;

export async function runAllScrapers(scrapers: Scraper[]): Promise<NewsItem[]> {
  const results = await Promise.allSettled(scrapers.map(s => s()));
  return results.flatMap(result => {
    if (result.status === "fulfilled") return result.value;
    console.error("[scraper] failed:", result.reason);
    return [];
  });
}

export async function scrapeAll(): Promise<NewsItem[]> {
  return scrapeAllWithAI();
}
