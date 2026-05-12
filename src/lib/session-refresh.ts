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

/** True when the access JWT is already past its backend-issued `exp` (we do not impose our own TTL). */
export function shouldRefreshAccessToken(accessToken: string): boolean {
  const exp = readJwtExpiresAt(accessToken);
  if (exp == null) return true;
  return exp <= Math.floor(Date.now() / 1000);
}

export async function refreshSessionWithBackend(session: SessionData): Promise<SessionData | null> {
  try {
    const res = await fetch(`${BACKEND_API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as RefreshEnvelope;
    if (!res.ok || !json.data?.accessToken || !json.data?.refreshToken || !json.data?.user) {
      return null;
    }
    return {
      accessToken: json.data.accessToken,
      refreshToken: json.data.refreshToken,
      user: json.data.user,
    };
  } catch {
    return null;
  }
}
