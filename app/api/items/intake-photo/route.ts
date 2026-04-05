import { NextResponse } from "next/server";

import { createDraftFromPhoto, getDraftViewById } from "@/lib/repository";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { fileName?: string; imageBase64?: string };

    if (!body.fileName) {
      return NextResponse.json({ error: "A file name or label description is required." }, { status: 400 });
    }

    const draft = await createDraftFromPhoto(body.fileName, body.imageBase64);
    const view = await getDraftViewById(draft.id);

    return NextResponse.json(
      view ?? {
        draftId: draft.id,
        matchedExpressionId: draft.matchedExpressionId,
        source: draft.source,
        barcode: draft.barcode,
        expression: draft.expression,
        suggestions: draft.suggestions
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Photo intake failed." },
      { status: 500 }
    );
  }
}
