import { NextResponse, type NextRequest } from "next/server";
import { canAccessPath, parseSessionCookie, SESSION_COOKIE_NAME } from "@/lib/session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = parseSessionCookie(req.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (!session) {
    const loginUrl = new URL("/login", req.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessPath(session.user.role, pathname)) {
    return NextResponse.redirect(new URL("/forbidden", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin/:path*", "/manager/:path*", "/staff/:path*"],
};

