import { NextResponse } from "next/server";

import { quickScanBottle, textScanBottle } from "@/lib/openai";
import { getPalateProfile } from "@/lib/repository";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      imageBase64?: string;
      imageMimeType?: string;
      query?: string;
    };

    const palate = await getPalateProfile();

    if (body.query?.trim()) {
      const result = await textScanBottle(body.query.trim(), palate);
      return NextResponse.json(result);
    }

    if (body.imageBase64) {
      const result = await quickScanBottle(body.imageBase64, body.imageMimeType ?? "image/jpeg", palate);
      if (!result) {
        return NextResponse.json({ error: "Could not identify the bottle." }, { status: 422 });
      }
      return NextResponse.json({ type: "result", data: result });
    }

    return NextResponse.json({ error: "Provide imageBase64 or query." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed.";
    console.error("[scan]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
