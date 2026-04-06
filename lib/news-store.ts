import { createClient } from "@supabase/supabase-js";
import type { NewsItem, ScoredNewsItem } from "@/lib/types";

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export function scoreToPalateStars(score: number): 0 | 1 | 2 | 3 {
  if (score >= 86) return 3;
  if (score >= 71) return 2;
  if (score >= 60) return 1;
  return 0;
}

export async function upsertNewsItems(items: NewsItem[]): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase || items.length === 0) return;

  const rows = items.map(item => ({
    source: item.source,
    kind: item.kind,
    name: item.name,
    price: item.price,
    original_price: item.originalPrice ?? null,
    discount_pct: item.discountPct ?? null,
    url: item.url,
    image_url: item.imageUrl ?? null,
    in_stock: item.inStock,
    fetched_at: new Date().toISOString()
  }));

  const { error } = await supabase
    .from("news_items")
    .upsert(rows, { onConflict: "source,url" });

  if (error) throw error;
}

export async function getNewsItems(): Promise<Array<{
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
  fetched_at: string;
}>> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("news_items")
    .select("*")
    .order("fetched_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as any;
}

export function isStale(fetchedAt: string): boolean {
  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  return ageMs > 12 * 60 * 60 * 1000;
}

export function latestFetchedAt(items: Array<{ fetched_at: string }>): string | null {
  if (items.length === 0) return null;
  return items.reduce((latest, item) =>
    item.fetched_at > latest ? item.fetched_at : latest,
    items[0].fetched_at
  );
}
