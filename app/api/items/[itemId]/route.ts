import { NextResponse } from "next/server";

import { saveDraftSchema, updateItemSchema } from "@/lib/schemas";
import { deleteItem, saveDraftAsItem, updateItem } from "@/lib/repository";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const body = await request.json();
    const saveDraftParsed = saveDraftSchema.safeParse(body);

    if (saveDraftParsed.success) {
      const item = await saveDraftAsItem(saveDraftParsed.data.draftId, saveDraftParsed.data);

      if (!item) {
        return NextResponse.json({ error: "Draft not found" }, { status: 404 });
      }

      return NextResponse.json({ itemId: item.id });
    }

    const updateParsed = updateItemSchema.safeParse(body);

    if (!updateParsed.success) {
      return NextResponse.json({ error: updateParsed.error.flatten() }, { status: 400 });
    }

    const { itemId } = await context.params;
    const item = await updateItem(itemId, updateParsed.data);

    if (!item) {
      return NextResponse.json({ error: "Bottle not found" }, { status: 404 });
    }

    return NextResponse.json({ itemId: item.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save the bottle." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await context.params;
    const deleted = await deleteItem(itemId);

    if (!deleted) {
      return NextResponse.json({ error: "Bottle not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete the bottle." },
      { status: 500 }
    );
  }
}
