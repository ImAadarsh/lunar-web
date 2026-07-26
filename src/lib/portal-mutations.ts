import { cookies } from "next/headers";
import { backendApiWithSession } from "@/lib/backend";
import { getSessionFromCookies } from "@/lib/server-session";
import { getSessionCookieStoreOptions, SESSION_COOKIE_NAME, type SessionData } from "@/lib/session";
import { refreshSessionWithBackend } from "@/lib/session-refresh";

export async function requirePortalSession() {
  const session = await getSessionFromCookies();
  if (!session) {
    throw new Error("Session expired. Please sign in again.");
  }
  return session;
}

async function persistSession(session: SessionData) {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, JSON.stringify(session), {
    ...getSessionCookieStoreOptions(),
  });
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

export async function mutateBackend(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
) {
  let session = await requirePortalSession();
  let res = await backendApiWithSession(path, session, { method, body });

  // Access JWT may have expired mid-batch (e.g. multi-shift save). Refresh once and retry.
  if (res.status === 401) {
    const next = await tryRefreshPortalSession(session);
    if (next) {
      session = next;
      res = await backendApiWithSession(path, session, { method, body });
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Session expired. Please sign in again.");
    }
    throw new Error(mutationErrorMessage(res));
  }
  return res.data;
}
