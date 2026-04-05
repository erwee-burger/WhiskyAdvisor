import { NextResponse } from "next/server";

import { refreshPricing } from "@/lib/repository";

export async function POST(
  _request: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await context.params;
  const pricing = await refreshPricing(itemId);

  if (!pricing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  return NextResponse.json(pricing);
}
