import { NextResponse } from "next/server";
import { backendApiWithSession } from "@/lib/backend";
import type { ShiftChatsListResponse } from "@/lib/pings-types";
import { getSessionFromCookies } from "@/lib/server-session";

function csvEscape(value: string | number | null | undefined) {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "supervisor"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const params = new URLSearchParams();
  for (const key of ["date", "siteId", "userId", "status"] as const) {
    const value = url.searchParams.get(key);
    if (value) params.set(key, value);
  }

  const query = params.toString();
  const path = query ? `/shift-chats?${query}` : "/shift-chats";
  const res = await backendApiWithSession<ShiftChatsListResponse>(path, session);
  if (!res.ok) {
    return NextResponse.json({ error: res.error?.message ?? "Unable to export threads" }, { status: res.status });
  }

  const items = res.data?.items ?? [];
  const header = [
    "id",
    "shiftId",
    "guardName",
    "siteName",
    "status",
    "messageCount",
    "unreadCount",
    "shiftStartsAt",
    "shiftEndsAt",
    "lastMessageAt",
  ];
  const rows = items.map((row) =>
    [
      row.id,
      row.shiftId,
      row.guardName,
      row.siteName,
      row.status,
      row.messageCount,
      row.unreadCount,
      row.shiftStartsAt,
      row.shiftEndsAt,
      row.lastMessageAt ?? "",
    ]
      .map(csvEscape)
      .join(","),
  );
  const csv = [header.join(","), ...rows].join("\n");
  const date = url.searchParams.get("date") ?? "export";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="shift-chats-${date}.csv"`,
    },
  });
}
