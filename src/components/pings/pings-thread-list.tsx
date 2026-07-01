import Link from "next/link";
import { StatusBadge } from "@/components/portal/status-badge";
import { formatUkDateTime, formatUkTime } from "@/lib/format-datetime";
import type { ShiftChatThread } from "@/lib/pings-types";
import { cn } from "@/lib/cn";

type PingsThreadListProps = {
  threads: ShiftChatThread[];
  selectedThreadId: number | null;
  buildThreadHref: (threadId: number) => string;
  buildResetHref: string;
};

function threadCountLabel(thread: ShiftChatThread) {
  const total = thread.messageCount;
  const unseen = thread.unreadCount;
  if (total === 0) return "No messages";
  if (unseen > 0) {
    return `${total} message${total === 1 ? "" : "s"}, ${unseen} unseen`;
  }
  return `${total} message${total === 1 ? "" : "s"}`;
}

export function PingsThreadList({
  threads,
  selectedThreadId,
  buildThreadHref,
  buildResetHref,
}: PingsThreadListProps) {
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden border-b border-[var(--portal-border)] lg:border-b-0 lg:border-r">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--portal-border)] px-4 py-3">
        <h3 className="portal-section-title">Shift threads</h3>
        <span className="text-xs text-[var(--portal-text-muted)]">{threads.length} total</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <p className="p-4 text-sm text-[var(--portal-text-muted)]">No shift chats for this date and filters.</p>
        ) : (
          <ul className="divide-y divide-[var(--portal-border)]">
            {threads.map((thread) => {
              const selected = selectedThreadId === thread.id;
              const hasUnread = thread.unreadCount > 0;
              return (
                <li key={thread.id}>
                  <Link
                    href={buildThreadHref(thread.id)}
                    className={cn(
                      "block px-4 py-3 transition-colors hover:bg-[var(--portal-table-row-hover)]",
                      selected && "bg-[var(--portal-table-row-hover)]/80",
                      hasUnread && !selected && "border-l-2 border-l-lunar-500",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-[var(--portal-text)]">{thread.guardName}</p>
                        <p className="truncate text-xs text-[var(--portal-text-muted)]">{thread.siteName}</p>
                      </div>
                      <StatusBadge status={thread.status} className="shrink-0 text-[10px]" />
                    </div>
                    <p className="mt-1 text-xs text-[var(--portal-text-muted)]">
                      {formatUkTime(thread.shiftStartsAt)} – {formatUkTime(thread.shiftEndsAt)}
                    </p>
                    <p
                      className={cn(
                        "mt-1.5 text-xs",
                        hasUnread ? "font-semibold text-lunar-700 dark:text-lunar-300" : "text-[var(--portal-text-muted)]",
                      )}
                    >
                      {threadCountLabel(thread)}
                    </p>
                    {thread.lastMessageAt ? (
                      <p className="mt-0.5 text-[10px] text-[var(--portal-text-muted)]">
                        Last: {formatUkDateTime(thread.lastMessageAt)}
                      </p>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {selectedThreadId ? (
        <div className="shrink-0 border-t border-[var(--portal-border)] p-3">
          <Link href={buildResetHref} className="lunar-btn-secondary lunar-btn-sm w-full text-center">
            Clear selection
          </Link>
        </div>
      ) : null}
    </aside>
  );
}
