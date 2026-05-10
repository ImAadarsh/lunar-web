import { cookies } from "next/headers";
import { parseSessionCookie, SESSION_COOKIE_NAME, type SessionData } from "@/lib/session";

export async function getSessionFromCookies(): Promise<SessionData | null> {
  const store = await cookies();
  return parseSessionCookie(store.get(SESSION_COOKIE_NAME)?.value);
}

