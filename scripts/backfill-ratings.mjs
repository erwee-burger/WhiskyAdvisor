/**
 * Backfill: set rating = 2 on all collection items that have no rating yet.
 *
 * Supports both Supabase and the local mock-store JSON file.
 *
 * Usage (from the project root):
 *   node --env-file=.env.local scripts/backfill-ratings.mjs
 *
 * For the local mock store (no .env.local / no Supabase vars):
 *   node scripts/backfill-ratings.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Supabase path ─────────────────────────────────────────────────────────────

if (url && serviceRoleKey) {
  console.log("Supabase env detected — updating via database.");

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: items, error: fetchError } = await supabase
    .from("collection_items")
    .select("id, rating")
    .is("rating", null);

  if (fetchError) {
    console.error("Failed to fetch items:", fetchError.message);
    process.exit(1);
  }

  if (!items || items.length === 0) {
    console.log("No unrated items found. Nothing to do.");
    process.exit(0);
  }

  console.log(`Found ${items.length} unrated item(s). Setting to 2 stars...`);

  const ids = items.map((item) => item.id);

  const { error: updateError } = await supabase
    .from("collection_items")
    .update({ rating: 2 })
    .in("id", ids);

  if (updateError) {
    console.error("Failed to update ratings:", updateError.message);
    process.exit(1);
  }

  console.log(`Done. ${ids.length} item(s) rated 2 stars.`);
  process.exit(0);
}

// ── Local mock-store path ─────────────────────────────────────────────────────

console.log("No Supabase env found — updating local mock-store.json.");

const storePath = path.join(__dirname, "../data/mock-store.json");

let store;
try {
  store = JSON.parse(await readFile(storePath, "utf8"));
} catch {
  console.error("Could not read data/mock-store.json. Has the app been run at least once?");
  process.exit(1);
}

if (!Array.isArray(store.collectionItems)) {
  console.error("mock-store.json does not contain a collectionItems array.");
  process.exit(1);
}

let updated = 0;
for (const item of store.collectionItems) {
  if (item.rating === undefined || item.rating === null) {
    item.rating = 2;
    item.isFavorite = false;
    item.updatedAt = new Date().toISOString();
    updated++;
  }
}

if (updated === 0) {
  console.log("No unrated items found. Nothing to do.");
  process.exit(0);
}

await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
console.log(`Done. ${updated} item(s) rated 2 stars in mock-store.json.`);
