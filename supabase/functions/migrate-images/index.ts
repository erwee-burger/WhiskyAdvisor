import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "bottle-images";

Deno.serve(async (req) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // Fetch all image rows
  const { data: rows, error: fetchError } = await supabase
    .from("item_images")
    .select("id, collection_item_id, url");

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const base64Rows = (rows ?? []).filter(
    (r) => typeof r.url === "string" && r.url.startsWith("data:")
  );

  if (base64Rows.length === 0) {
    return new Response(
      JSON.stringify({ message: "No base64 images found — nothing to migrate.", migrated: 0, failed: 0 }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of base64Rows) {
    const { id, collection_item_id, url: dataUrl } = row;

    // Parse the data URL
    const commaIndex = dataUrl.indexOf(",");
    if (commaIndex === -1) {
      errors.push(`Row ${id}: malformed data URL`);
      failed++;
      continue;
    }

    const header = dataUrl.slice(0, commaIndex);
    const base64Data = dataUrl.slice(commaIndex + 1);

    const mimeMatch = header.match(/data:([^;]+);/);
    const mimeType = mimeMatch?.[1] ?? "image/jpeg";
    const ext = mimeType === "image/png" ? "png" : "jpg";
    const path = `${collection_item_id}/${id}.${ext}`;

    // Decode base64 to binary
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: mimeType, upsert: true });

    if (uploadError) {
      errors.push(`Row ${id}: ${uploadError.message}`);
      failed++;
      continue;
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    // Update the database row
    const { error: updateError } = await supabase
      .from("item_images")
      .update({ url: urlData.publicUrl })
      .eq("id", id);

    if (updateError) {
      errors.push(`Row ${id}: DB update failed — ${updateError.message}`);
      failed++;
      continue;
    }

    succeeded++;
  }

  return new Response(
    JSON.stringify({
      total: base64Rows.length,
      migrated: succeeded,
      failed,
      errors
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
