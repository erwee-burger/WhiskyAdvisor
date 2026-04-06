import { NextResponse } from "next/server";

import { barcodeSchema } from "@/lib/schemas";
import { createDraftFromBarcode, getDraftViewById } from "@/lib/repository";

export async function POST(request: Request) {
  try {
    const parsed = barcodeSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const draft = await createDraftFromBarcode(parsed.data.barcode);
    const view = await getDraftViewById(draft.id);

    return NextResponse.json(
      view ?? {
        draftId: draft.id,
        matchedExpressionId: draft.matchedExpressionId,
        source: draft.source,
        barcode: draft.barcode,
        identification: draft.identification,
        rawExpression: draft.rawExpression,
        expression: draft.expression,
        suggestions: draft.suggestions,
        reviewItems: draft.reviewItems,
        citations: draft.citations
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Barcode lookup failed." },
      { status: 500 }
    );
  }
}
