import { NextResponse, type NextRequest } from "next/server";

/**
 * A first, quick gate in front of the admin portal: anyone without a session
 * cookie is sent to the login page before any admin page starts to render.
 * This is NOT the security check. Every admin page and action still verifies
 * the session against the database (requireAdmin).
 */
const ADMIN_COOKIE = "plw_admin";
const LOGIN_PATH = "/admin/login";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasCookie = request.cookies.has(ADMIN_COOKIE);
  if (!hasCookie && pathname !== LOGIN_PATH) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
