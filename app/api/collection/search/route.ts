// app/api/collection/search/route.ts
import { NextResponse } from "next/server";

import { getSessionMode } from "@/lib/auth";
import { buildSearchHaystack } from "@/lib/collection-filters";
import { getCollectionView } from "@/lib/repository";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sessionMode = await getSessionMode();
  if (sessionMode !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const collection = await getCollectionView();

  const results = collection
    .filter((entry) => buildSearchHaystack(entry).includes(q))
    .slice(0, 5)
    .map((entry) => ({
      id: entry.item.id,
      name: entry.expression.name,
      status: entry.item.status,
      fillState: entry.item.fillState
    }));

  return NextResponse.json({ results });
}
