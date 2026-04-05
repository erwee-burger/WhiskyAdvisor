import { NextResponse } from "next/server";

import { barcodeSchema } from "@/lib/schemas";
import { createDraftFromBarcode } from "@/lib/repository";

export async function POST(request: Request) {
  const parsed = barcodeSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const draft = await createDraftFromBarcode(parsed.data.barcode);

  return NextResponse.json({
    draftId: draft.id,
    matchedExpressionId: draft.matchedExpressionId,
    source: draft.source,
    barcode: draft.barcode,
    expression: draft.expression,
    suggestions: draft.suggestions
  });
}
