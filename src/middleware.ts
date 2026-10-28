import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken, getAuthSecret } from "@/lib/auth-token";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Whitelist static assets & public system routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/assets") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/api/health" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/session" ||
    pathname.startsWith("/api/internal/") ||
    pathname.startsWith("/api/integrations/")
  ) {
    return NextResponse.next();
  }

  // 2. Check session token
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const secret = getAuthSecret();
  const isValid = await verifySessionToken(token, secret);

  // 3. Login page handling
  if (pathname === "/login") {
    if (isValid) {
      const nextUrl = request.nextUrl.searchParams.get("next") || "/";
      return NextResponse.redirect(new URL(nextUrl, request.url));
    }
    return NextResponse.next();
  }

  // 4. Protected routes: block unauthorized access
  if (!isValid) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
