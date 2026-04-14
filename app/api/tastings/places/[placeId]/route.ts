import { NextResponse } from "next/server";

import { deleteTastingPlace, updateTastingPlace } from "@/lib/repository";
import { tastingPlaceSchema } from "@/lib/schemas";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ placeId: string }> }
) {
  try {
    const parsed = tastingPlaceSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { placeId } = await context.params;
    const place = await updateTastingPlace(placeId, parsed.data);

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    return NextResponse.json(place);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the place.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ placeId: string }> }
) {
  try {
    const { placeId } = await context.params;
    const deleted = await deleteTastingPlace(placeId);

    if (!deleted) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete the place.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
