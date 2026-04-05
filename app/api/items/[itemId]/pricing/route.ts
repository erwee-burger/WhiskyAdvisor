import { NextResponse } from "next/server";

import { getPricing } from "@/lib/repository";

export async function GET(
  _request: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await context.params;
  const pricing = await getPricing(itemId);

  if (!pricing) {
    return NextResponse.json({ error: "Pricing not found" }, { status: 404 });
  }

  return NextResponse.json(pricing);
}
