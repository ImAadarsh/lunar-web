export type BackendRole = "admin" | "supervisor" | "guard";

export type SessionUser = {
  id: number;
  email: string;
  role: BackendRole;
};

export type SessionData = {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
};

export const SESSION_COOKIE_NAME = "lsw_session";

/** Match backend refresh token lifetime so the browser keeps the session across restarts. */
const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/** Cookie flags shared by login, middleware, and session refresh. */
export function getSessionCookieStoreOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  };
}

export function parseSessionCookie(raw?: string | null): SessionData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionData;
    if (!parsed?.accessToken || !parsed?.refreshToken || !parsed?.user?.id || !parsed?.user?.role) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function webRoleLabel(role: BackendRole): "Admin" | "Manager" | "Staff" {
  if (role === "admin") return "Admin";
  if (role === "supervisor") return "Manager";
  return "Staff";
}

export function canAccessPath(role: BackendRole, pathname: string): boolean {
  if (pathname === "/profile" || pathname.startsWith("/profile/")) return true;
  if (pathname.startsWith("/admin")) return role === "admin";
  if (pathname.startsWith("/manager")) return role === "admin" || role === "supervisor";
  if (pathname.startsWith("/staff")) return role === "guard";
  return true;
}
