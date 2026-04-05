import { NextResponse } from "next/server";

import { createDraftFromPhoto } from "@/lib/repository";

export async function POST(request: Request) {
  const body = (await request.json()) as { fileName?: string; imageBase64?: string };

  if (!body.fileName) {
    return NextResponse.json({ error: "fileName is required" }, { status: 400 });
  }

  const draft = await createDraftFromPhoto(body.fileName, body.imageBase64);

  return NextResponse.json({
    draftId: draft.id,
    matchedExpressionId: draft.matchedExpressionId,
    source: draft.source,
    barcode: draft.barcode,
    expression: draft.expression,
    suggestions: draft.suggestions
  });
}
