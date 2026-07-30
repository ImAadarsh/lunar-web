import { cookies } from "next/headers";
import { backendApiWithSession } from "@/lib/backend";
import { getSessionFromCookies } from "@/lib/server-session";
import { getSessionCookieStoreOptions, SESSION_COOKIE_NAME, type SessionData } from "@/lib/session";
import {
  isAccessTokenExpired,
  refreshSessionWithBackend,
  shouldRefreshAccessToken,
} from "@/lib/session-refresh";

export const SESSION_EXPIRED_MESSAGE = "Session expired. Please sign in again.";

export async function requirePortalSession() {
  const session = await getSessionFromCookies();
  if (!session) {
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }
  return session;
}

async function persistSession(session: SessionData) {
  try {
    const store = await cookies();
    store.set(SESSION_COOKIE_NAME, JSON.stringify(session), {
      ...getSessionCookieStoreOptions(),
    });
  } catch {
    // Cookie writes are rejected outside actions/route handlers. The in-memory
    // session is still usable for this request, so never fail the mutation here.
  }
}

/** Refresh the portal cookie once and return the new session, or null if refresh failed. */
async function tryRefreshPortalSession(session: SessionData): Promise<SessionData | null> {
  const refreshed = await refreshSessionWithBackend(session);
  if (!refreshed.ok) return null;
  await persistSession(refreshed.session);
  return refreshed.session;
}

function mutationErrorMessage(res: {
  error?: { message?: string; details?: unknown } | null;
}): string {
  const details = res.error?.details;
  const fieldErrors =
    details &&
    typeof details === "object" &&
    "fieldErrors" in details &&
    details.fieldErrors &&
    typeof details.fieldErrors === "object"
      ? Object.entries(details.fieldErrors as Record<string, unknown>)
          .flatMap(([field, messages]) =>
            Array.isArray(messages) ? messages.map((message) => `${field}: ${message}`) : [],
          )
          .join("; ")
      : "";
  return fieldErrors || res.error?.message || "Request failed";
}

export type MutationOutcome<T = unknown> =
  | { ok: true; data: T | null }
  | { ok: false; message: string; sessionExpired: boolean };

/**
 * Mutation variant that reports failures as a value instead of throwing.
 *
 * Server Actions that throw have their message replaced by an opaque digest in
 * production builds, so callers that surface a reason to the user must use this.
 */
export async function mutateBackendResult<T = unknown>(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
): Promise<MutationOutcome<T>> {
  let session = await getSessionFromCookies();
  if (!session) {
    return { ok: false, message: SESSION_EXPIRED_MESSAGE, sessionExpired: true };
  }

  // Refresh up front when close to expiry so a long batch cannot die part-way through.
  if (shouldRefreshAccessToken(session.accessToken)) {
    const next = await tryRefreshPortalSession(session);
    if (next) {
      session = next;
    } else if (isAccessTokenExpired(session.accessToken)) {
      return { ok: false, message: SESSION_EXPIRED_MESSAGE, sessionExpired: true };
    }
  }

  let res = await backendApiWithSession<T>(path, session, { method, body });

  if (res.status === 401) {
    const next = await tryRefreshPortalSession(session);
    if (next) {
      session = next;
      res = await backendApiWithSession<T>(path, session, { method, body });
    }
  }

  if (!res.ok) {
    const message = res.status === 401 ? SESSION_EXPIRED_MESSAGE : mutationErrorMessage(res);
    console.error(`[portal-mutation] ${method} ${path} -> ${res.status}: ${message}`);
    return { ok: false, message, sessionExpired: res.status === 401 };
  }
  return { ok: true, data: res.data };
}

export async function mutateBackend(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
) {
  const result = await mutateBackendResult(path, method, body);
  if (!result.ok) throw new Error(result.message);
  return result.data;
}
