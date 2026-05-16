const RETURN_TO_PARAM = "returnTo";
const SESSION_RETURN_KEY = "portal:returnTo";

/** Paths where the portal "Back" control should return to the previous screen. */
const DETAIL_PATH =
  /^\/(admin|manager|staff)\/(users|sites|incidents|guards)\/\d+(\/|$)/;

export function isPortalDetailPath(pathname: string) {
  return DETAIL_PATH.test(pathname);
}

/** Only allow same-app relative paths (no open redirects). */
export function safeReturnPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return null;
  if (decoded.includes("\\") || decoded.includes("\n")) return null;
  return decoded;
}

export function buildHrefWithReturnTo(href: string, returnTo: string) {
  const safe = safeReturnPath(returnTo);
  if (!safe) return href;
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set(RETURN_TO_PARAM, safe);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function readReturnToFromSearch(searchParams: URLSearchParams | { get: (k: string) => string | null }) {
  return safeReturnPath(searchParams.get(RETURN_TO_PARAM));
}

export function sessionReturnPath(): string | null {
  if (typeof window === "undefined") return null;
  return safeReturnPath(sessionStorage.getItem(SESSION_RETURN_KEY));
}

export function writeSessionReturnPath(path: string) {
  if (typeof window === "undefined") return;
  const safe = safeReturnPath(path);
  if (safe) sessionStorage.setItem(SESSION_RETURN_KEY, safe);
}

export function clearSessionReturnPath() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_RETURN_KEY);
}

export function canUseBrowserBack(): boolean {
  if (typeof window === "undefined") return false;
  const ref = document.referrer;
  if (!ref) return false;
  try {
    return new URL(ref).origin === window.location.origin;
  } catch {
    return false;
  }
}
