import { NextResponse } from "next/server";
import { backendApiWithSession } from "@/lib/backend";
import type { ShiftChatMessagesResponse } from "@/lib/pings-types";
import { getSessionFromCookies } from "@/lib/server-session";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "supervisor"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const threadId = Number(id);
  if (!threadId) return NextResponse.json({ error: "Invalid thread id" }, { status: 400 });

  const url = new URL(request.url);
  const sinceId = Number(url.searchParams.get("sinceId") ?? "0") || 0;
  const params = new URLSearchParams();
  if (sinceId > 0) params.set("sinceId", String(sinceId));

  const query = params.toString();
  const path = query ? `/shift-chats/${threadId}/messages?${query}` : `/shift-chats/${threadId}/messages`;
  const res = await backendApiWithSession<ShiftChatMessagesResponse>(path, session);
  if (!res.ok) {
    return NextResponse.json({ error: res.error?.message ?? "Unable to load messages" }, { status: res.status });
  }
  return NextResponse.json(res.data ?? { items: [] });
}
