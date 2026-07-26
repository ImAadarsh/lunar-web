import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionCookieStoreOptions, parseSessionCookie, SESSION_COOKIE_NAME } from "@/lib/session";
import {
  isAccessTokenExpired,
  refreshSessionWithBackend,
  shouldRefreshAccessToken,
} from "@/lib/session-refresh";

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

  const result = await refreshSessionWithBackend(session);
  if (result.ok) {
    store.set(SESSION_COOKIE_NAME, JSON.stringify(result.session), {
      ...getSessionCookieStoreOptions(),
    });
    return NextResponse.json({ ok: true });
  }

  if (result.reason === "unavailable") {
    // Backend blip — keep cookie; client should not force logout.
    return new NextResponse(null, { status: 204 });
  }

  if (!isAccessTokenExpired(session.accessToken)) {
    // Likely a refresh-token rotation race; access token still works.
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json({ error: "Session refresh failed" }, { status: 401 });
}
