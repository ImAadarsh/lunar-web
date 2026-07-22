import Link from "next/link";
import { redirect } from "next/navigation";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { PortalPage, PortalPageBody, PortalPageHeader } from "@/components/portal/portal-page-layout";
import { PingsChatPanel } from "@/components/pings/pings-chat-panel";
import { PingsFilterBar } from "@/components/pings/pings-filter-bar";
import { PingsThreadList } from "@/components/pings/pings-thread-list";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { formatUkDateOnly } from "@/lib/format-datetime";
import { displayGuardName } from "@/lib/leave-month-stats";
import type {
  ShiftChatMessagesResponse,
  ShiftChatThreadDetail,
  ShiftChatsListResponse,
  ShiftChatsSummaryResponse,
} from "@/lib/pings-types";
import { getSessionFromCookies } from "@/lib/server-session";
import { ukTodayDate } from "@/lib/uk-datetime";

const BASE_PATH = "/manager/pings";
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

type SitesResponse = { items: Array<{ id: number; name: string }> };
type UsersResponse = {
  items: Array<{ id: number; email: string; role: string; status: string; fullName?: string | null }>;
};

type ManagerPingsPageProps = {
  searchParams: Promise<{
    date?: string;
    siteId?: string;
    userId?: string;
    status?: string;
    threadId?: string;
  }>;
};

function parsePingsDate(value: string | undefined) {
  const raw = value?.trim();
  if (raw && DATE_ONLY.test(raw)) return raw;
  return ukTodayDate();
}

function buildPingsQuery(params: Record<string, string | undefined>, extra?: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...extra })) {
    if (value) q.set(key, value);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export default async function ManagerPingsPage({ searchParams }: ManagerPingsPageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!["admin", "supervisor"].includes(session.user.role)) redirect("/forbidden");

  const params = await searchParams;
  const date = parsePingsDate(params.date);
  const siteId = (params.siteId ?? "").trim();
  const userId = (params.userId ?? "").trim();
  const status = (params.status ?? "").trim();
  const threadId = Number(params.threadId ?? "") || null;

  const filterQuery = new URLSearchParams({ date });
  if (siteId) filterQuery.set("siteId", siteId);
  if (userId) filterQuery.set("userId", userId);
  if (status) filterQuery.set("status", status);

  const [threadsRes, summaryRes, sitesRes, usersRes] = await Promise.all([
    backendApiWithSession<ShiftChatsListResponse>(`/shift-chats?${filterQuery}`, session),
    backendApiWithSession<ShiftChatsSummaryResponse>(`/shift-chats/summary?${filterQuery}`, session),
    backendApiWithSession<SitesResponse>("/sites?limit=1000", session),
    backendApiWithSession<UsersResponse>("/users?role=guard&limit=200", session),
  ]);

  const threads = threadsRes.data?.items ?? [];
  const sites = sitesRes.data?.items ?? [];
  const guards = (usersRes.data?.items ?? []).map((user) => ({
    id: user.id,
    name: displayGuardName(user.fullName, user.email),
  }));

  let selectedThread: ShiftChatThreadDetail | null = null;
  let initialMessages: ShiftChatMessagesResponse["items"] = [];

  if (threadId) {
    const fromList = threads.find((t) => t.id === threadId);
    const [detailRes, messagesRes] = await Promise.all([
      fromList
        ? Promise.resolve({ ok: true as const, data: fromList as ShiftChatThreadDetail, status: 200, error: null })
        : backendApiWithSession<ShiftChatThreadDetail>(`/shift-chats/${threadId}`, session),
      backendApiWithSession<ShiftChatMessagesResponse>(`/shift-chats/${threadId}/messages`, session),
    ]);
    selectedThread = detailRes.data;
    initialMessages = messagesRes.data?.items ?? [];
  }

  const loadErrors = [
    apiErrorMessage("Shift chats", threadsRes),
    apiErrorMessage("Unread summary", summaryRes),
    apiErrorMessage("Sites", sitesRes),
    apiErrorMessage("Guards", usersRes),
    threadId && !selectedThread ? `Thread #${threadId} not found or unavailable.` : null,
  ];

  const filterState = { date, siteId, userId, status };
  const exportHref = `/api/portal/shift-chats/export${buildPingsQuery(filterState)}`;
  const resetHref = `${BASE_PATH}${buildPingsQuery(filterState)}`;

  const totalUnread =
    summaryRes.data?.messageCount ?? threads.reduce((sum, t) => sum + t.unreadCount, 0);

  return (
    <PortalPage>
      <PortalPageHeader
        title="Pings & Chat"
        description={
          <>
            Shift guard messaging for {formatUkDateOnly(date)}
            {totalUnread > 0 ? (
              <span className="ml-2 rounded-full bg-lunar-100 px-2 py-0.5 text-xs font-semibold text-lunar-800 dark:bg-lunar-900/50 dark:text-lunar-200">
                {totalUnread} unread
              </span>
            ) : null}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a href={exportHref} className="lunar-btn-secondary lunar-btn-sm">
              Export CSV
            </a>
            {session.user.role === "admin" ? (
              <Link href="/admin/reports" className="lunar-btn-secondary lunar-btn-sm">
                Reports
              </Link>
            ) : null}
          </div>
        }
      >
        <ApiErrorNotice errors={loadErrors} />
        <PingsFilterBar
          basePath={BASE_PATH}
          date={date}
          siteId={siteId}
          userId={userId}
          status={status}
          threadId={threadId ? String(threadId) : undefined}
          sites={sites}
          guards={guards}
        />
      </PortalPageHeader>

      <PortalPageBody card className="min-h-0 flex-1 overflow-hidden p-0">
        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(18rem,22rem)_1fr]">
          <PingsThreadList
            threads={threads}
            selectedThreadId={threadId}
            buildThreadHref={(id) =>
              `${BASE_PATH}${buildPingsQuery(filterState, { threadId: String(id) })}`
            }
            buildResetHref={resetHref}
          />
          <PingsChatPanel
            thread={selectedThread}
            initialMessages={initialMessages}
            currentUserId={session.user.id}
          />
        </div>
      </PortalPageBody>
    </PortalPage>
  );
}
