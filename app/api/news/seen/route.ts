import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionMode } from "@/lib/auth";
import { saveNewsSeenKeys } from "@/lib/news-visit-store";

const PostSeenSchema = z.object({
  seenKeys: z.array(z.string().trim().min(1)).max(500).transform((value) => [...new Set(value)])
});

export async function POST(req: Request) {
  try {
    const sessionMode = await getSessionMode();
    if (sessionMode !== "owner") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = PostSeenSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid seen keys", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    await saveNewsSeenKeys(parsed.data.seenKeys);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/news/seen] POST failed:", err);
    return NextResponse.json({ error: "Failed to save seen state" }, { status: 500 });
  }
}
