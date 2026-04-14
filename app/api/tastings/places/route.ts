import { NextResponse } from "next/server";

import { createTastingPlace, getTastingPlaces } from "@/lib/repository";
import { tastingPlaceSchema } from "@/lib/schemas";

export async function GET() {
  const places = await getTastingPlaces();
  return NextResponse.json(places);
}

export async function POST(request: Request) {
  try {
    const parsed = tastingPlaceSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const place = await createTastingPlace(parsed.data);
    return NextResponse.json(place, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the place.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
