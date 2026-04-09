import { NextResponse } from "next/server";

import { setBottleRating } from "@/lib/repository";
import { ratingSchema } from "@/lib/schemas";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await context.params;
  const parsed = ratingSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { rating, isFavorite } = parsed.data;
  const item = await setBottleRating(
    itemId,
    rating as 1 | 2 | 3 | null,
    isFavorite ?? false
  );

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  return NextResponse.json(item);
}
