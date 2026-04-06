import type { NewsItem } from "@/lib/types";
import { scrapeWhiskyBrother } from "@/lib/scrapers/whiskybrother";
import { scrapeBottegaWhiskey } from "@/lib/scrapers/bottegawhiskey";
import { scrapeMotherCityLiquor } from "@/lib/scrapers/mothercityliquor";
import { scrapeWhiskyEmporium } from "@/lib/scrapers/whiskyemporium";
import { scrapeNormanGoodfellows } from "@/lib/scrapers/normangoodfellows";

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
  return runAllScrapers([
    scrapeWhiskyBrother,
    scrapeBottegaWhiskey,
    scrapeMotherCityLiquor,
    scrapeWhiskyEmporium,
    scrapeNormanGoodfellows
  ]);
}
