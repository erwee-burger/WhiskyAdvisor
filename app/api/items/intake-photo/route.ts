import { NextResponse } from "next/server";

import { intakePhotoSchema } from "@/lib/schemas";
import { createDraftFromPhoto, getDraftViewById } from "@/lib/repository";

export async function POST(request: Request) {
  try {
    const parsed = intakePhotoSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const draft = await createDraftFromPhoto(
      parsed.data.fileName,
      parsed.data.imageBase64,
      parsed.data.imageMimeType
    );
    const view = await getDraftViewById(draft.id);
    const response = view
      ? {
          ...view,
          collectionItemId: draft.collectionItemId,
          distilleryName: view.expression.distilleryName,
          bottlerName: view.expression.bottlerName
        }
      : {
          draftId: draft.id,
          collectionItemId: draft.collectionItemId,
          source: draft.source,
          barcode: draft.barcode,
          distilleryName: draft.expression.distilleryName,
          bottlerName: draft.expression.bottlerName,
          expression: draft.expression,
          collection: draft.collection
        };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Photo intake failed." },
      { status: 500 }
    );
  }
}
