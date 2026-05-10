import { backendApiWithSession } from "@/lib/backend";
import { getSessionFromCookies } from "@/lib/server-session";

export async function requirePortalSession() {
  const session = await getSessionFromCookies();
  if (!session) {
    throw new Error("Session expired. Please sign in again.");
  }
  return session;
}

export async function mutateBackend(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown) {
  const session = await requirePortalSession();
  const res = await backendApiWithSession(path, session, { method, body });
  if (!res.ok) {
    throw new Error(res.error?.message ?? "Request failed");
  }
  return res.data;
}

