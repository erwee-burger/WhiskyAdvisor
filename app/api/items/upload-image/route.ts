import { NextResponse } from "next/server";
import { z } from "zod";

import { createId } from "@/lib/id";
import { createSupabaseClient } from "@/lib/supabase-client";

const BUCKET_NAME = "bottle-images";

const uploadSchema = z
  .object({
    dataUrl: z.string().min(1),
    collectionItemId: z.string().optional()
  })
  .strip();

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = uploadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { dataUrl, collectionItemId } = parsed.data;

  const [header, base64Data] = dataUrl.split(",");
  if (!header || !base64Data) {
    return NextResponse.json({ error: "Invalid image data URL format" }, { status: 400 });
  }

  const mimeMatch = header.match(/data:([^;]+);/);
  const mimeType = mimeMatch?.[1] ?? "image/jpeg";
  const ext = mimeType === "image/png" ? "png" : "jpg";

  const imageId = createId("img");
  const folder = collectionItemId || "uploads";
  const path = `${folder}/${imageId}.${ext}`;

  const binaryData = Buffer.from(base64Data, "base64");

  const supabase = createSupabaseClient();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, binaryData, { contentType: mimeType, upsert: true });

  if (uploadError) {
    return NextResponse.json(
      { error: `Failed to upload image: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
  return NextResponse.json({ url: urlData.publicUrl });
}
