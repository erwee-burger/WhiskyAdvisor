import { NextResponse } from "next/server";

import { exportCollection } from "@/lib/repository";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "json" ? "json" : "csv";
  const payload = await exportCollection(format);

  return new NextResponse(payload, {
    status: 200,
    headers: {
      "Content-Type": format === "json" ? "application/json" : "text/csv",
      "Content-Disposition": `attachment; filename="whisky-collection.${format}"`
    }
  });
}
