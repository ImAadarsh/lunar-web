"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { PingMessageBubble } from "@/components/pings/ping-message-bubble";
import { markShiftChatReadAction, sendShiftChatMessageAction } from "@/lib/pings-actions";
import type { ShiftChatMessage, ShiftChatThreadDetail } from "@/lib/pings-types";
import { formatUkRange } from "@/lib/format-datetime";
import Link from "next/link";
import { StatusBadge } from "@/components/portal/status-badge";

type PingsChatClientProps = {
  thread: ShiftChatThreadDetail;
  initialMessages: ShiftChatMessage[];
  currentUserId: number;
};

export function PingsChatClient({ thread, initialMessages, currentUserId }: PingsChatClientProps) {
  const [messages, setMessages] = useState<ShiftChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const latestId = messages.reduce((max, msg) => Math.max(max, msg.id), 0);

  useEffect(() => {
    setMessages(initialMessages);
    setDraft("");
    setError(null);
  }, [thread.id, initialMessages]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    markShiftChatReadAction(thread.id).catch(() => undefined);
  }, [thread.id]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const params = new URLSearchParams({ sinceId: String(latestId) });
      const res = await fetch(`/api/portal/shift-chats/${thread.id}/messages?${params}`, { cache: "no-store" });
      if (!res.ok) {
        if (!cancelled) setError("Unable to refresh messages.");
        return;
      }
      const body = (await res.json()) as { items?: ShiftChatMessage[] };
      if (!cancelled && body.items?.length) {
        setMessages((current) => {
          const seen = new Set(current.map((m) => m.id));
          const merged = [...current];
          for (const msg of body.items!) {
            if (!seen.has(msg.id)) merged.push(msg);
          }
          return merged.sort((a, b) => a.id - b.id);
        });
        setError(null);
        markShiftChatReadAction(thread.id).catch(() => undefined);
      }
    }

    const id = window.setInterval(() => {
      poll().catch(() => {
        if (!cancelled) setError("Unable to refresh messages.");
      });
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [thread.id, latestId]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || isPending) return;

    startTransition(async () => {
      const result = await sendShiftChatMessageAction(thread.id, body);
      if (!result.ok) {
        setError(result.error ?? "Unable to send message.");
        return;
      }
      setDraft("");
      setError(null);
      const params = new URLSearchParams({ sinceId: String(latestId) });
      const res = await fetch(`/api/portal/shift-chats/${thread.id}/messages?${params}`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { items?: ShiftChatMessage[] };
        if (data.items?.length) {
          setMessages((current) => {
            const seen = new Set(current.map((m) => m.id));
            const merged = [...current];
            for (const msg of data.items ?? []) {
              if (!seen.has(msg.id)) merged.push(msg);
            }
            return merged.sort((a, b) => a.id - b.id);
          });
        }
      }
      markShiftChatReadAction(thread.id).catch(() => undefined);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-[var(--portal-border)] px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display text-base font-semibold text-[var(--portal-text)]">{thread.guardName}</h3>
            <p className="text-sm text-[var(--portal-text-muted)]">
              <Link href={`/manager/sites/${thread.siteId}`} className="text-[var(--portal-link)] hover:underline">
                {thread.siteName}
              </Link>
              {" · "}
              <Link href={`/manager/guards/${thread.userId}`} className="text-[var(--portal-link)] hover:underline">
                Guard profile
              </Link>
              {" · "}
              <Link href={`/manager/shifts`} className="text-[var(--portal-link)] hover:underline">
                Shift #{thread.shiftId}
              </Link>
            </p>
            <p className="mt-0.5 text-xs text-[var(--portal-text-muted)]">
              {formatUkRange(thread.shiftStartsAt, thread.shiftEndsAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={thread.status} />
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              Live
            </span>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-[var(--portal-text-muted)]">No messages yet. Say hello to the guard.</p>
        ) : (
          messages.map((message) => (
            <PingMessageBubble
              key={message.id}
              message={message}
              isOwnMessage={message.senderUserId === currentUserId}
            />
          ))
        )}
      </div>

      {error ? (
        <p className="shrink-0 border-t border-[var(--portal-border)] bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSend} className="shrink-0 border-t border-[var(--portal-border)] p-4">
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Reply to guard…"
            rows={2}
            className="lunar-input min-h-[2.75rem] flex-1 resize-none"
            disabled={isPending || thread.status === "closed"}
          />
          <button
            type="submit"
            className="lunar-btn-primary self-end"
            disabled={isPending || !draft.trim() || thread.status === "closed"}
          >
            {isPending ? "Sending…" : "Send"}
          </button>
        </div>
        {thread.status === "closed" ? (
          <p className="mt-2 text-xs text-[var(--portal-text-muted)]">This shift chat is closed — read only.</p>
        ) : null}
      </form>
    </div>
  );
}
