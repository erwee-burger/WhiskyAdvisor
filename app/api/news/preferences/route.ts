// app/api/news/preferences/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getNewsPreferences, saveNewsPreferences } from "@/lib/news-preferences-store";

const PatchPreferencesSchema = z.object({
  softBudgetCapZar:    z.number().positive(),
  stretchBudgetCapZar: z.number().positive().nullable()
});

export async function GET() {
  try {
    const prefs = await getNewsPreferences();
    return NextResponse.json(prefs);
  } catch (err) {
    console.error("[api/news/preferences] GET failed:", err);
    return NextResponse.json({ error: "Failed to load preferences" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const parsed = PatchPreferencesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid preferences", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    await saveNewsPreferences(parsed.data);
    return NextResponse.json(parsed.data);
  } catch (err) {
    console.error("[api/news/preferences] PATCH failed:", err);
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
  }
}
