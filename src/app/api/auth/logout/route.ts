import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { backendApi } from "@/lib/backend";
import { parseSessionCookie, SESSION_COOKIE_NAME } from "@/lib/session";

export async function POST() {
  const store = await cookies();
  const session = parseSessionCookie(store.get(SESSION_COOKIE_NAME)?.value);

  if (session) {
    await backendApi("/auth/logout", {
      method: "POST",
      accessToken: session.accessToken,
      body: { refreshToken: session.refreshToken },
    }).catch(() => null);
  }

  store.delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ success: true });
}

