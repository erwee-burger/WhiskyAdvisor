import { NextResponse } from "next/server";

import {
  classifyExpressionFlavorProfileByItemId,
  getExpressionFlavorProfileByItemId
} from "@/lib/repository";

export async function GET(
  _request: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await context.params;
  const profile = await getExpressionFlavorProfileByItemId(itemId);

  if (!profile) {
    return NextResponse.json({ error: "Flavor profile not found" }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await context.params;
  const profile = await classifyExpressionFlavorProfileByItemId(itemId);

  if (!profile) {
    return NextResponse.json({ error: "Bottle not found" }, { status: 404 });
  }

  return NextResponse.json(profile);
}
