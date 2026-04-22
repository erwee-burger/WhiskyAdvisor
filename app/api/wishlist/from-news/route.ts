import { NextResponse } from "next/server";
import { z } from "zod";

import { addToWishlistFromNews } from "@/lib/repository";

const AddToWishlistSchema = z.object({
  name:     z.string().min(1),
  price:    z.number().positive(),
  source:   z.string().min(1),
  imageUrl: z.string().url().optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = AddToWishlistSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await addToWishlistFromNews(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/wishlist/from-news] POST failed:", err);
    const message = err instanceof Error ? err.message : "Could not add to wishlist.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
