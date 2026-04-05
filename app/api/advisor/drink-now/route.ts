import { NextResponse } from "next/server";

import { getAdvisor } from "@/lib/repository";

export async function GET() {
  return NextResponse.json(await getAdvisor("drink-now"));
}
