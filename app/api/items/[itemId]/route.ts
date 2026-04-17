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
      const result = await saveDraftAsItem(saveDraftParsed.data.draftId, saveDraftParsed.data);

      if (!result) {
        return NextResponse.json({ error: "Draft not found" }, { status: 404 });
      }

      return NextResponse.json({ itemId: result.item.id, flavorRefreshNeeded: result.flavorRefreshNeeded });
    }

    const updateParsed = updateItemSchema.safeParse(body);

    if (!updateParsed.success) {
      return NextResponse.json({ error: updateParsed.error.flatten() }, { status: 400 });
    }

    const { itemId } = await context.params;
    const result = await updateItem(itemId, updateParsed.data);

    if (!result) {
      return NextResponse.json({ error: "Bottle not found" }, { status: 404 });
    }

    return NextResponse.json({ itemId: result.item.id, flavorRefreshNeeded: result.flavorRefreshNeeded });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "Could not save the bottle.";
    return NextResponse.json({ error: message }, { status: 500 });
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
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "Could not delete the bottle.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
