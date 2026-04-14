import { NextResponse } from "next/server";

import { deleteTastingSession, updateTastingSession } from "@/lib/repository";
import { tastingSessionSchema } from "@/lib/schemas";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const parsed = tastingSessionSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { sessionId } = await context.params;
    const session = await updateTastingSession(sessionId, parsed.data);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the tasting session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const deleted = await deleteTastingSession(sessionId);

    if (!deleted) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete the tasting session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
