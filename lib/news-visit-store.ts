import { createClient } from "@supabase/supabase-js";

const MAX_SEEN_ITEM_KEYS = 500;

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getNewsSeenKeys(): Promise<string[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("news_seen_state")
    .select("seen_keys")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return Array.isArray(data.seen_keys)
    ? data.seen_keys.filter((value): value is string => typeof value === "string")
    : [];
}

export async function saveNewsSeenKeys(keys: string[]): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const dedupedKeys = Array.from(new Set(keys)).slice(-MAX_SEEN_ITEM_KEYS);

  const { error } = await supabase
    .from("news_seen_state")
    .upsert({
      id: 1,
      seen_keys: dedupedKeys,
      updated_at: new Date().toISOString()
    }, { onConflict: "id" });

  if (error) throw error;
}
