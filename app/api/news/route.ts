// app/api/news/route.ts
import { NextResponse } from "next/server";
import { getLatestSuccessfulSnapshot, isStale } from "@/lib/news-store";
import { getNewsPreferences } from "@/lib/news-preferences-store";
import type { NewsSnapshotResponse } from "@/lib/types";

export async function GET() {
  try {
    const prefs = await getNewsPreferences();
    const snapshot = await getLatestSuccessfulSnapshot(prefs);

    if (!snapshot) {
      const empty: NewsSnapshotResponse = {
        specials:     [],
        newArrivals:  [],
        summaryCards: [],
        fetchedAt:    null,
        stale:        true,
        preferences:  prefs
      };
      return NextResponse.json(empty);
    }

    const response: NewsSnapshotResponse = {
      specials:     snapshot.specials,
      newArrivals:  snapshot.newArrivals,
      summaryCards: snapshot.summaryCards,
      fetchedAt:    snapshot.fetchedAt,
      stale:        isStale(snapshot.fetchedAt),
      preferences:  prefs
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[api/news] GET failed:", err);
    return NextResponse.json({ error: "Failed to load news" }, { status: 500 });
  }
}
