import { NextResponse } from "next/server";

import { getAnalytics } from "@/lib/repository";

export async function GET() {
  return NextResponse.json(await getAnalytics());
}
