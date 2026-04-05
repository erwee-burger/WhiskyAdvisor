import { NextResponse } from "next/server";

import { getPalateProfile } from "@/lib/repository";

export async function GET() {
  return NextResponse.json(await getPalateProfile());
}
