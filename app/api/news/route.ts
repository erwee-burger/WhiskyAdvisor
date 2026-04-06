import { NextResponse } from "next/server";
import { getNewsItems, latestFetchedAt, isStale } from "@/lib/news-store";

export async function GET() {
  try {
    const items = await getNewsItems();
    const fetchedAt = latestFetchedAt(items);
    const stale = fetchedAt ? isStale(fetchedAt) : true;

    const specials = items.filter(i => i.kind === "special");
    const newReleases = items.filter(i => i.kind === "new_release");

    return NextResponse.json({ specials, newReleases, fetchedAt, stale });
  } catch (err) {
    console.error("[api/news] GET failed:", err);
    return NextResponse.json({ error: "Failed to load news" }, { status: 500 });
  }
}
