// lib/news-preferences-store.ts
import { createClient } from "@supabase/supabase-js";
import type { NewsBudgetPreferences } from "@/lib/types";

const DEFAULT_PREFERENCES: NewsBudgetPreferences = {
  softBudgetCapZar: 1000,
  stretchBudgetCapZar: null
};

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getNewsPreferences(): Promise<NewsBudgetPreferences> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ...DEFAULT_PREFERENCES };

  const { data, error } = await supabase
    .from("news_preferences")
    .select("soft_budget_cap_zar, stretch_budget_cap_zar")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { ...DEFAULT_PREFERENCES };

  return {
    softBudgetCapZar:    Number(data.soft_budget_cap_zar),
    stretchBudgetCapZar: data.stretch_budget_cap_zar !== null
      ? Number(data.stretch_budget_cap_zar)
      : null
  };
}

export async function saveNewsPreferences(prefs: NewsBudgetPreferences): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return; // no-op in local mode

  const { error } = await supabase
    .from("news_preferences")
    .upsert({
      id:                     1,
      soft_budget_cap_zar:    prefs.softBudgetCapZar,
      stretch_budget_cap_zar: prefs.stretchBudgetCapZar,
      updated_at:             new Date().toISOString()
    }, { onConflict: "id" });

  if (error) throw error;
}
