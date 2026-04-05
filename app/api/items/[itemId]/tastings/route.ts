import { NextResponse } from "next/server";

import { addTastingEntry } from "@/lib/repository";
import { tastingSchema } from "@/lib/schemas";

export async function POST(
  request: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await context.params;
  const parsed = tastingSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const entry = await addTastingEntry(itemId, parsed.data);

  if (!entry) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  return NextResponse.json(entry);
}
