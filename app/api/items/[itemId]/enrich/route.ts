import { NextResponse } from "next/server";

import { getDraftById, getItemById } from "@/lib/repository";

export async function POST(
  _request: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await context.params;
  const draft = await getDraftById(itemId);

  if (draft) {
    return NextResponse.json(draft);
  }

  const item = await getItemById(itemId);

  if (!item) {
    return NextResponse.json({ error: "Draft or item not found" }, { status: 404 });
  }

  return NextResponse.json({
    expression: item.expression,
    citations: [],
    suggestions: [
      {
        field: "name",
        label: "Bottle name",
        confidence: 0.99
      }
    ]
  });
}
