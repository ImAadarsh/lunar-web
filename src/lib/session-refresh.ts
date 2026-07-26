import { BACKEND_API_BASE } from "@/lib/backend";
import type { SessionData } from "@/lib/session";
import { readJwtExpiresAt } from "@/lib/jwt-exp";

type RefreshEnvelope = {
  data?: {
    accessToken: string;
    refreshToken: string;
    user: SessionData["user"];
  };
};

export type RefreshResult =
  | { ok: true; session: SessionData }
  | { ok: false; reason: "unauthorized" | "unavailable" };

/** Refresh when access JWT is expired or within this many seconds of expiring. */
export const ACCESS_REFRESH_SKEW_SECONDS = 10 * 60; // 10 minutes

/** True when the access JWT should be refreshed (expired or near expiry). */
export function shouldRefreshAccessToken(accessToken: string): boolean {
  const exp = readJwtExpiresAt(accessToken);
  if (exp == null) return true;
  return exp <= Math.floor(Date.now() / 1000) + ACCESS_REFRESH_SKEW_SECONDS;
}

/** True when the access JWT is already past `exp` (cannot authorize API calls). */
export function isAccessTokenExpired(accessToken: string): boolean {
  const exp = readJwtExpiresAt(accessToken);
  if (exp == null) return true;
  return exp <= Math.floor(Date.now() / 1000);
}

export async function refreshSessionWithBackend(session: SessionData): Promise<RefreshResult> {
  try {
    const res = await fetch(`${BACKEND_API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as RefreshEnvelope;
    if (!res.ok || !json.data?.accessToken || !json.data?.refreshToken || !json.data?.user) {
      return { ok: false, reason: res.status >= 500 || res.status === 0 ? "unavailable" : "unauthorized" };
    }
    return {
      ok: true,
      session: {
        accessToken: json.data.accessToken,
        refreshToken: json.data.refreshToken,
        user: json.data.user,
      },
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
