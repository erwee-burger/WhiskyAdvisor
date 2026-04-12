// lib/news-store.ts
import { createClient } from "@supabase/supabase-js";
import type { NewsFeedItem, NewsSummaryCard, NewsBudgetPreferences } from "@/lib/types";
import type { GptOffer, GptSummaryCardShape } from "@/lib/news-gpt";
import { computeBudgetFit } from "@/lib/news-budget";

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const STALE_MS = 12 * 60 * 60 * 1000; // 12 hours

export function isStale(fetchedAt: string): boolean {
  return Date.now() - new Date(fetchedAt).getTime() > STALE_MS;
}

// ── Refresh lifecycle ─────────────────────────────────────────────────────────

export async function createRefresh(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("news_refreshes")
    .insert({ status: "pending" })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function markRefreshSuccess(refreshId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from("news_refreshes")
    .update({ status: "success", completed_at: new Date().toISOString() })
    .eq("id", refreshId);

  if (error) throw error;
}

export async function markRefreshFailed(refreshId: string, errorText: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from("news_refreshes")
    .update({ status: "failed", completed_at: new Date().toISOString(), error_text: errorText })
    .eq("id", refreshId);

  if (error) throw error;
}

// ── Item insertion ────────────────────────────────────────────────────────────

export async function insertNewsItems(
  refreshId: string,
  offers: GptOffer[],
  kind: "special" | "new_release"
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase || offers.length === 0) return;

  const rows = offers.map(o => ({
    refresh_id:      refreshId,
    source:          o.source,
    kind:            kind,
    name:            o.name,
    price:           o.price,
    original_price:  o.originalPrice ?? null,
    discount_pct:    o.discountPct ?? null,
    url:             o.url,
    image_url:       o.imageUrl ?? null,
    in_stock:        o.inStock,
    relevance_score: o.relevanceScore,
    why_it_matters:  o.whyItMatters,
    citations:       o.citations
  }));

  const { error } = await supabase.from("news_items").insert(rows);
  if (error) throw error;
}

export async function insertSummaryCards(
  refreshId: string,
  cards: Array<{ cardType: "best_value" | "worth_stretching" | "most_interesting"; card: GptSummaryCardShape }>
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase || cards.length === 0) return;

  const rows = cards.map(({ cardType, card }) => ({
    refresh_id:     refreshId,
    card_type:      cardType,
    title:          card.title,
    subtitle:       card.subtitle ?? null,
    price:          card.price ?? null,
    url:            card.url ?? null,
    why_it_matters: card.whyItMatters ?? null,
    source:         card.source ?? null
  }));

  const { error } = await supabase.from("news_summary_cards").insert(rows);
  if (error) throw error;
}

// ── Snapshot read ─────────────────────────────────────────────────────────────

export interface SnapshotRow {
  fetchedAt: string;
  specials: NewsFeedItem[];
  newArrivals: NewsFeedItem[];
  summaryCards: NewsSummaryCard[];
}

export async function getLatestSuccessfulSnapshot(
  prefs: NewsBudgetPreferences
): Promise<SnapshotRow | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  // Find the latest successful refresh
  const { data: refresh, error: refreshError } = await supabase
    .from("news_refreshes")
    .select("id, completed_at")
    .eq("status", "success")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  if (refreshError || !refresh) return null;

  const refreshId = refresh.id as string;
  const fetchedAt = refresh.completed_at as string;

  // Fetch items and summary cards in parallel
  const [itemsResult, cardsResult] = await Promise.all([
    supabase
      .from("news_items")
      .select("*")
      .eq("refresh_id", refreshId)
      .order("relevance_score", { ascending: false }),
    supabase
      .from("news_summary_cards")
      .select("*")
      .eq("refresh_id", refreshId)
  ]);

  if (itemsResult.error) throw itemsResult.error;
  if (cardsResult.error) throw cardsResult.error;

  const rawItems = (itemsResult.data ?? []) as Array<{
    id: string;
    source: string;
    kind: string;
    name: string;
    price: number;
    original_price: number | null;
    discount_pct: number | null;
    url: string;
    image_url: string | null;
    in_stock: boolean;
    relevance_score: number;
    why_it_matters: string | null;
    citations: string[];
  }>;

  const feedItems: NewsFeedItem[] = rawItems.map(r => ({
    id:             r.id,
    source:         r.source,
    kind:           r.kind as "special" | "new_release",
    name:           r.name,
    price:          r.price,
    originalPrice:  r.original_price ?? undefined,
    discountPct:    r.discount_pct ?? undefined,
    url:            r.url,
    imageUrl:       r.image_url ?? undefined,
    inStock:        r.in_stock,
    relevanceScore: r.relevance_score,
    budgetFit:      computeBudgetFit(r.price, prefs),
    whyItMatters:   r.why_it_matters,
    citations:      Array.isArray(r.citations) ? r.citations as string[] : []
  }));

  const rawCards = (cardsResult.data ?? []) as Array<{
    card_type: string;
    title: string;
    subtitle: string | null;
    price: number | null;
    url: string | null;
    why_it_matters: string | null;
    source: string | null;
  }>;

  const summaryCards: NewsSummaryCard[] = rawCards.map(c => ({
    cardType:      c.card_type as NewsSummaryCard["cardType"],
    title:         c.title,
    subtitle:      c.subtitle ?? undefined,
    price:         c.price ?? undefined,
    url:           c.url ?? undefined,
    whyItMatters:  c.why_it_matters ?? undefined,
    source:        c.source ?? undefined
  }));

  return {
    fetchedAt,
    specials:     feedItems.filter(i => i.kind === "special"),
    newArrivals:  feedItems.filter(i => i.kind === "new_release"),
    summaryCards
  };
}
