import { NextResponse } from "next/server";

import { saveDraftSchema } from "@/lib/schemas";
import { saveDraftAsItem } from "@/lib/repository";

export async function PATCH(request: Request) {
  const parsed = saveDraftSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const item = await saveDraftAsItem(parsed.data.draftId, parsed.data);

  if (!item) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  return NextResponse.json({ itemId: item.id });
}
