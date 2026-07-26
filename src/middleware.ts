import { NextResponse, type NextRequest } from "next/server";
import {
  canAccessPath,
  getSessionCookieStoreOptions,
  parseSessionCookie,
  SESSION_COOKIE_NAME,
} from "@/lib/session";
import {
  isAccessTokenExpired,
  refreshSessionWithBackend,
  shouldRefreshAccessToken,
} from "@/lib/session-refresh";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = parseSessionCookie(req.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (!session) {
    const loginUrl = new URL("/login", req.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  const cookieOpts = getSessionCookieStoreOptions();
  let activeSession = session;
  let refreshedPayload: string | null = null;

  if (shouldRefreshAccessToken(session.accessToken)) {
    const refreshed = await refreshSessionWithBackend(session);
    if (refreshed.ok) {
      activeSession = refreshed.session;
      refreshedPayload = JSON.stringify(refreshed.session);
    } else if (refreshed.reason === "unauthorized" && isAccessTokenExpired(session.accessToken)) {
      // Only hard-logout when the access token is already dead and refresh was rejected.
      // Transient backend/network failures (or refresh races) must not wipe the cookie.
      const loginUrl = new URL("/login", req.url);
      if (pathname !== "/") {
        loginUrl.searchParams.set("next", pathname);
      }
      const res = NextResponse.redirect(loginUrl);
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }
    // If refresh failed but access token is still valid (skew window / race / outage), continue.
  }

  const withCookie = (res: NextResponse) => {
    if (refreshedPayload) {
      res.cookies.set(SESSION_COOKIE_NAME, refreshedPayload, cookieOpts);
    }
    return res;
  };

  if (!canAccessPath(activeSession.user.role, pathname)) {
    return withCookie(NextResponse.redirect(new URL("/forbidden", req.url)));
  }

  return withCookie(NextResponse.next());
}

export const config = {
  matcher: ["/", "/profile", "/profile/:path*", "/admin/:path*", "/manager/:path*", "/staff/:path*"],
};
