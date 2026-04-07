/**
 * One-time migration: move base64 bottle images from the Supabase database
 * into the Supabase Storage bucket "bottle-images".
 *
 * Usage (from the project root):
 *   node --env-file=.env.local scripts/migrate-images.mjs
 */

import { createClient } from "@supabase/supabase-js";

const BUCKET = "bottle-images";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// ── Fetch all image rows ────────────────────────────────────────────────────

const { data: rows, error: fetchError } = await supabase
  .from("item_images")
  .select("id, collection_item_id, url");

if (fetchError) {
  console.error("Failed to fetch item_images:", fetchError.message);
  process.exit(1);
}

const base64Rows = (rows ?? []).filter((r) => typeof r.url === "string" && r.url.startsWith("data:"));

if (base64Rows.length === 0) {
  console.log("No base64 images found — nothing to migrate.");
  process.exit(0);
}

console.log(`Found ${base64Rows.length} image(s) to migrate.\n`);

let succeeded = 0;
let failed = 0;

for (const row of base64Rows) {
  const { id, collection_item_id, url: dataUrl } = row;

  // Parse the data URL
  const [header, base64Data] = dataUrl.split(",");
  if (!header || !base64Data) {
    console.warn(`  [SKIP] Row ${id}: malformed data URL`);
    failed++;
    continue;
  }

  const mimeMatch = header.match(/data:([^;]+);/);
  const mimeType = mimeMatch?.[1] ?? "image/jpeg";
  const ext = mimeType === "image/png" ? "png" : "jpg";
  const path = `${collection_item_id}/${id}.${ext}`;

  // Upload to storage
  const buffer = Buffer.from(base64Data, "base64");
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: true });

  if (uploadError) {
    console.error(`  [FAIL] Row ${id}: ${uploadError.message}`);
    failed++;
    continue;
  }

  // Get the public URL
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  // Update the database row
  const { error: updateError } = await supabase
    .from("item_images")
    .update({ url: publicUrl })
    .eq("id", id);

  if (updateError) {
    console.error(`  [FAIL] Row ${id}: DB update failed — ${updateError.message}`);
    failed++;
    continue;
  }

  console.log(`  [OK]   Row ${id} → ${publicUrl}`);
  succeeded++;
}

console.log(`\nDone. ${succeeded} migrated, ${failed} failed.`);
