// app/api/news/refresh/route.ts
import { NextResponse } from "next/server";
import { getNewsPreferences } from "@/lib/news-preferences-store";
import { discoverNewsWithGpt } from "@/lib/news-gpt";
import {
  createRefresh,
  insertNewsItems,
  insertSummaryCards,
  markRefreshSuccess,
  markRefreshFailed
} from "@/lib/news-store";
import { getServerEnv } from "@/lib/env";
import type { PalateProfile } from "@/lib/types";

export const maxDuration = 120;

async function loadPalateProfile(): Promise<PalateProfile | null> {
  try {
    const { getDashboardData } = await import("@/lib/repository");
    const { profile } = await getDashboardData();
    return profile;
  } catch {
    return null;
  }
}

export async function POST() {
  const { OPENAI_API_KEY } = getServerEnv();
  if (!OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: "OPENAI_API_KEY not configured" }, { status: 503 });
  }

  const [prefs, profile] = await Promise.all([
    getNewsPreferences(),
    loadPalateProfile()
  ]);

  const refreshId = await createRefresh();
  if (!refreshId) {
    // Supabase not configured - silently succeed with 0 items
    return NextResponse.json({ ok: true, count: 0, note: "Supabase not configured" });
  }

  try {
    const discovered = await discoverNewsWithGpt(profile, prefs);

    const cardEntries = [
      discovered.summaryCards.bestValue
        ? { cardType: "best_value" as const, card: discovered.summaryCards.bestValue }
        : null,
      discovered.summaryCards.worthStretching
        ? { cardType: "worth_stretching" as const, card: discovered.summaryCards.worthStretching }
        : null,
      discovered.summaryCards.mostInteresting
        ? { cardType: "most_interesting" as const, card: discovered.summaryCards.mostInteresting }
        : null
    ].filter(Boolean) as Array<{ cardType: "best_value" | "worth_stretching" | "most_interesting"; card: import("@/lib/news-gpt").GptSummaryCardShape }>;

    await Promise.all([
      insertNewsItems(refreshId, discovered.specials, "special"),
      insertNewsItems(refreshId, discovered.newArrivals, "new_release"),
      insertSummaryCards(refreshId, cardEntries)
    ]);

    await markRefreshSuccess(refreshId);

    const count = discovered.specials.length + discovered.newArrivals.length;
    if (count === 0) {
      console.warn("[api/news/refresh] zero items discovered - check GPT logs for validation failures");
    }
    console.log(`[api/news/refresh] success - ${count} items in refresh ${refreshId}`);
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    const errorText = err instanceof Error ? err.message : String(err);
    console.error("[api/news/refresh] failed:", errorText);
    await markRefreshFailed(refreshId, errorText).catch(() => {});
    return NextResponse.json({ ok: false, error: "Refresh failed" }, { status: 500 });
  }
}
