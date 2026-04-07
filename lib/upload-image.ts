"use client";

import { createSupabaseClient } from "./supabase-client";
import { createId } from "./id";

const BUCKET_NAME = "bottle-images";

/**
 * Uploads an image to Supabase Storage and returns the public URL.
 * @param dataUrl - Data URL string (e.g., "data:image/jpeg;base64,...")
 * @param collectionItemId - The collection item ID to organize storage
 * @returns Public URL of the uploaded image
 * @throws Error if upload fails or Supabase is not configured
 */
export async function uploadImageToSupabase(
  dataUrl: string,
  collectionItemId?: string
): Promise<string> {
  // Parse the data URL
  const [header, base64Data] = dataUrl.split(",");
  if (!header || !base64Data) {
    throw new Error("Invalid image data URL format");
  }

  const mimeMatch = header.match(/data:([^;]+);/);
  const mimeType = mimeMatch?.[1] ?? "image/jpeg";
  const ext = mimeType === "image/png" ? "png" : "jpg";

  // Generate storage path
  const imageId = createId("img");
  const folder = collectionItemId || "uploads";
  const path = `${folder}/${imageId}.${ext}`;

  // Convert base64 to blob for browser environment
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });

  // Upload to Supabase Storage
  const supabase = createSupabaseClient();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, blob, { contentType: mimeType, upsert: true });

  if (uploadError) {
    throw new Error(`Failed to upload image: ${uploadError.message}`);
  }

  // Get the public URL
  const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
  return urlData.publicUrl;
}
