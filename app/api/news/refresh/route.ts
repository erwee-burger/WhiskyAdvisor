import { NextResponse } from "next/server";
import { scrapeAll } from "@/lib/scrapers/index";
import { upsertNewsItems } from "@/lib/news-store";

export const maxDuration = 60;

export async function POST() {
  try {
    const items = await scrapeAll();
    if (items.length === 0) {
      console.warn("[api/news/refresh] all scrapers returned 0 items");
    }
    await upsertNewsItems(items);
    return NextResponse.json({ count: items.length, ok: true });
  } catch (err) {
    console.error("[api/news/refresh] POST failed:", err);
    return NextResponse.json({ ok: false, error: "Refresh failed" }, { status: 500 });
  }
}
