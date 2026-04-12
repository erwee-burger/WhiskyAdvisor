import { NextResponse } from "next/server";

import { enrichBottleFieldRequestSchema } from "@/lib/bottle-detail";
import { suggestBottleFieldUpdate } from "@/lib/item-enrichment";
import { getItemById } from "@/lib/repository";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const parsed = enrichBottleFieldRequestSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { itemId } = await context.params;
    const entry = await getItemById(itemId);

    if (!entry) {
      return NextResponse.json({ error: "Bottle not found" }, { status: 404 });
    }

    const suggestion = await suggestBottleFieldUpdate({
      entry,
      field: parsed.data.field,
      currentValue: parsed.data.currentValue,
      draftValues: parsed.data.draftValues
    });

    return NextResponse.json(suggestion);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "Could not generate an AI suggestion for this field.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
