import { NextResponse } from "next/server";

import { compareSchema } from "@/lib/schemas";
import { compareWhiskies } from "@/lib/repository";

export async function POST(request: Request) {
  const parsed = compareSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const comparison = await compareWhiskies(parsed.data.leftId, parsed.data.rightId);

  if (!comparison) {
    return NextResponse.json({ error: "Could not compare those whiskies" }, { status: 404 });
  }

  return NextResponse.json(comparison);
}
