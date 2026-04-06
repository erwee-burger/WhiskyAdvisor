import { NextResponse } from "next/server";
import { getNewsItems, latestFetchedAt, isStale } from "@/lib/news-store";

export async function GET() {
  const items = await getNewsItems();
  const fetchedAt = latestFetchedAt(items);
  const stale = fetchedAt ? isStale(fetchedAt) : true;

  const specials = items.filter(i => i.kind === "special");
  const newReleases = items.filter(i => i.kind === "new_release");

  return NextResponse.json({ specials, newReleases, fetchedAt, stale });
}
