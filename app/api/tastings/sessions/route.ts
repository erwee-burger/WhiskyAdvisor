import { NextResponse } from "next/server";

import {
  createQuickBottleShare,
  createTastingSession,
  getTastingSessions
} from "@/lib/repository";
import { quickBottleShareSchema, tastingSessionSchema } from "@/lib/schemas";

export async function GET() {
  const sessions = await getTastingSessions();
  return NextResponse.json(sessions);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const quickShareParsed = quickBottleShareSchema.safeParse(body);

    if (quickShareParsed.success) {
      const session = await createQuickBottleShare(quickShareParsed.data);
      return NextResponse.json(session, { status: 201 });
    }

    const sessionParsed = tastingSessionSchema.safeParse(body);
    if (!sessionParsed.success) {
      return NextResponse.json({ error: sessionParsed.error.flatten() }, { status: 400 });
    }

    const session = await createTastingSession(sessionParsed.data);
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the tasting session.";
    const status =
      message.includes("Quick share needs at least one real attendee.") ||
      message.includes("Only owned bottles that are not finished can be shared.")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
