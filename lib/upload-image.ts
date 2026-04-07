"use client";

/**
 * Uploads an image to Supabase Storage via the server-side API route and returns the public URL.
 * @param dataUrl - Data URL string (e.g., "data:image/jpeg;base64,...")
 * @param collectionItemId - The collection item ID to organize storage
 * @returns Public URL of the uploaded image
 * @throws Error if upload fails
 */
export async function uploadImageToSupabase(
  dataUrl: string,
  collectionItemId?: string
): Promise<string> {
  const response = await fetch("/api/items/upload-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl, collectionItemId })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? "Failed to upload image");
  }

  const data = await response.json() as { url: string };
  return data.url;
}
