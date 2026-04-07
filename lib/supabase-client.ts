import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client for use in the browser.
 * Uses SUPABASE_URL and SUPABASE_ANON_KEY from environment variables.
 */
export function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase URL and Anon Key are required");
  }

  return createClient(url, anonKey);
}

/**
 * Checks if Supabase is configured and ready for use.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  return Boolean(url && anonKey);
}
