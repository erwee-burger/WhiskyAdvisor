import { NextResponse } from "next/server";

const ACCESS_COOKIE_NAME = "whisky_access";

function safeNextPath(value: unknown) {
  if (typeof value !== "string") {
    return "/";
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export async function POST(request: Request) {
  const lockEnabled = process.env.APP_LOCK_ENABLED?.toLowerCase() === "true";
  const accessToken = process.env.APP_ACCESS_TOKEN;

  if (!lockEnabled || !accessToken) {
    return NextResponse.json({ ok: true, redirectTo: "/" });
  }

  const body = (await request.json().catch(() => null)) as
    | { token?: string; next?: string }
    | null;

  if (!body?.token || body.token !== accessToken) {
    return NextResponse.json(
      { ok: false, error: "Invalid access token" },
      { status: 401 }
    );
  }

  const redirectTo = safeNextPath(body.next);
  const response = NextResponse.json({ ok: true, redirectTo });

  response.cookies.set({
    name: ACCESS_COOKIE_NAME,
    value: accessToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });

  return response;
}
