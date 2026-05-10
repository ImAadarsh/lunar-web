import { NextResponse } from "next/server";
import { backendApiWithSession } from "@/lib/backend";
import { getSessionFromCookies } from "@/lib/server-session";

type CommandEvents = {
  items: Array<{
    id: number;
    type: string;
    actorUserId?: number | null;
    subjectUserId?: number | null;
    siteId?: number | null;
    entityType?: string | null;
    entityId?: string | null;
    payload?: unknown;
    createdAt: string;
  }>;
};

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "supervisor"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const sinceId = Number(url.searchParams.get("sinceId") ?? "0") || 0;
  const siteId = url.searchParams.get("siteId");
  const params = new URLSearchParams({ sinceId: String(sinceId), limit: "100" });
  if (siteId) params.set("siteId", siteId);

  const res = await backendApiWithSession<CommandEvents>(`/command/events?${params.toString()}`, session);
  if (!res.ok) {
    return NextResponse.json({ error: res.error?.message ?? "Unable to load command events" }, { status: res.status });
  }
  return NextResponse.json(res.data ?? { items: [] });
}
