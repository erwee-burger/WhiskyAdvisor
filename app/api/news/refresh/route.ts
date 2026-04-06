import { NextResponse } from "next/server";
import { scrapeAll } from "@/lib/scrapers/index";
import { upsertNewsItems } from "@/lib/news-store";

export const maxDuration = 60;

export async function POST() {
  const items = await scrapeAll();
  await upsertNewsItems(items);
  return NextResponse.json({ count: items.length, ok: true });
}
