import { NextResponse } from "next/server";

import { quickScanBottle } from "@/lib/openai";
import { getPalateProfile } from "@/lib/repository";

export async function POST(request: Request) {
  try {
    const { imageBase64, imageMimeType } = (await request.json()) as {
      imageBase64?: string;
      imageMimeType?: string;
    };

    if (!imageBase64) {
      return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });
    }

    const palate = await getPalateProfile();
    const result = await quickScanBottle(imageBase64, imageMimeType ?? "image/jpeg", palate);

    if (!result) {
      return NextResponse.json({ error: "Could not identify the bottle." }, { status: 422 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed.";
    console.error("[scan]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
