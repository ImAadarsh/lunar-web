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
    const details = res.error?.details;
    const fieldErrors =
      details &&
      typeof details === "object" &&
      "fieldErrors" in details &&
      details.fieldErrors &&
      typeof details.fieldErrors === "object"
        ? Object.entries(details.fieldErrors as Record<string, unknown>)
            .flatMap(([field, messages]) =>
              Array.isArray(messages) ? messages.map((message) => `${field}: ${message}`) : []
            )
            .join("; ")
        : "";
    throw new Error(fieldErrors || res.error?.message || "Request failed");
  }
  return res.data;
}

