import { NextResponse } from "next/server";

import { quickAddItem } from "@/lib/repository";

export async function POST(request: Request) {
  try {
    const { name, distilleryName, tastingNotes, description, status } = (await request.json()) as {
      name?: string;
      distilleryName?: string;
      tastingNotes?: string[];
      description?: string;
      status?: "owned" | "wishlist";
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const { itemId } = await quickAddItem({
      name: name.trim(),
      distilleryName: distilleryName?.trim(),
      tastingNotes,
      description: description?.trim(),
      status: status === "wishlist" ? "wishlist" : "owned"
    });

    return NextResponse.json({ itemId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quick add failed.";
    console.error("[scan/add]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
