import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionCookieStoreOptions, parseSessionCookie, SESSION_COOKIE_NAME } from "@/lib/session";
import { refreshSessionWithBackend, shouldRefreshAccessToken } from "@/lib/session-refresh";

/**
 * Keeps the httpOnly session cookie aligned with short-lived access JWTs.
 * No-op (204) when the access token is still fresh enough.
 */
export async function POST() {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookie(raw);
  if (!session) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }
  if (!shouldRefreshAccessToken(session.accessToken)) {
    return new NextResponse(null, { status: 204 });
  }

  const nextSession = await refreshSessionWithBackend(session);
  if (!nextSession) {
    return NextResponse.json({ error: "Session refresh failed" }, { status: 401 });
  }

  store.set(SESSION_COOKIE_NAME, JSON.stringify(nextSession), {
    ...getSessionCookieStoreOptions(),
  });
  return NextResponse.json({ ok: true });
}
