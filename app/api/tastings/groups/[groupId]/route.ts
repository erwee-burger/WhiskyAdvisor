import { NextResponse } from "next/server";

import { deleteTastingGroup, updateTastingGroup } from "@/lib/repository";
import { tastingGroupSchema } from "@/lib/schemas";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ groupId: string }> }
) {
  try {
    const parsed = tastingGroupSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { groupId } = await context.params;
    const group = await updateTastingGroup(groupId, parsed.data);

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json(group);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the group.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await context.params;
    const deleted = await deleteTastingGroup(groupId);

    if (!deleted) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete the group.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
