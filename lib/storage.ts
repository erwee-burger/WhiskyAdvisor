import { createClient } from "@supabase/supabase-js";

const BUCKET = "bottle-images";

function getStorageClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

/**
 * Uploads a base64 data URL to Supabase Storage and returns the public URL.
 * Returns null if storage is not configured or the upload fails.
 */
export async function uploadBottleImage(dataUrl: string, itemId: string): Promise<string | null> {
  if (!dataUrl.startsWith("data:")) {
    // Already a remote URL — no upload needed
    return dataUrl;
  }

  const client = getStorageClient();
  if (!client) return null;

  try {
    const [header, base64Data] = dataUrl.split(",");
    if (!header || !base64Data) return null;

    const mimeMatch = header.match(/data:([^;]+);/);
    const mimeType = mimeMatch?.[1] ?? "image/jpeg";
    const ext = mimeType === "image/png" ? "png" : "jpg";

    const buffer = Buffer.from(base64Data, "base64");
    const path = `${itemId}/${Date.now()}.${ext}`;

    const { error } = await client.storage.from(BUCKET).upload(path, buffer, {
      contentType: mimeType,
      upsert: true
    });

    if (error) {
      console.error("[storage] Upload failed:", error.message);
      return null;
    }

    const { data } = client.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error("[storage] Unexpected error:", err);
    return null;
  }
}
