import { NextResponse } from "next/server";

import { createTastingGroup, getTastingGroups } from "@/lib/repository";
import { tastingGroupSchema } from "@/lib/schemas";

export async function GET() {
  const groups = await getTastingGroups();
  return NextResponse.json(groups);
}

export async function POST(request: Request) {
  try {
    const parsed = tastingGroupSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const group = await createTastingGroup(parsed.data);
    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the group.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
