import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const ACCESS_COOKIE_NAME = "whisky_access";

function isPublicPath(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/bottles") ||
    pathname === "/unlock" ||
    pathname === "/api/auth/unlock"
  );
}

export function middleware(request: NextRequest) {
  const lockEnabled = process.env.APP_LOCK_ENABLED?.toLowerCase() === "true";
  const accessToken = process.env.APP_ACCESS_TOKEN;

  if (!lockEnabled || !accessToken) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const cookieToken = request.cookies.get(ACCESS_COOKIE_NAME)?.value;

  if (cookieToken === accessToken) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const unlockUrl = request.nextUrl.clone();
  unlockUrl.pathname = "/unlock";
  unlockUrl.searchParams.set("next", `${pathname}${search}`);

  return NextResponse.redirect(unlockUrl);
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"]
};
