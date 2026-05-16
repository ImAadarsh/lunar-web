"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUkDateTime } from "@/lib/format-datetime";

type CommandEvent = {
  id: number;
  type: string;
  actorUserId?: number | null;
  subjectUserId?: number | null;
  siteId?: number | null;
  entityType?: string | null;
  entityId?: string | null;
  payload?: unknown;
  createdAt: string;
};

type CommandEventFeedProps = {
  initialEvents: CommandEvent[];
  siteId?: number | null;
};

export function CommandEventFeed({ initialEvents, siteId }: CommandEventFeedProps) {
  const [events, setEvents] = useState<CommandEvent[]>(initialEvents);
  const [error, setError] = useState<string | null>(null);
  const latestId = useMemo(() => events.reduce((max, event) => Math.max(max, event.id), 0), [events]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const params = new URLSearchParams({ sinceId: String(latestId) });
      if (siteId) params.set("siteId", String(siteId));
      const res = await fetch(`/api/portal/command-events?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        if (!cancelled) setError("Unable to load live command events.");
        return;
      }
      const body = (await res.json()) as { items?: CommandEvent[] };
      if (!cancelled && body.items?.length) {
        setEvents((current) => [...body.items!, ...current].slice(0, 30));
        setError(null);
      }
    }
    const id = window.setInterval(() => {
      poll().catch(() => {
        if (!cancelled) setError("Unable to load live command events.");
      });
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [latestId, siteId]);

  return (
    <article className="lunar-card lunar-card-pad">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="portal-section-title">Live command feed</h3>
          <p className="text-sm text-slate-500">Polls backend command events every 5 seconds.</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Live</span>
      </div>
      {error ? <p className="mt-3 rounded-md bg-rose-50 p-2 text-sm text-rose-700">{error}</p> : null}
      <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">No command events yet.</p>
        ) : (
          events.map((event) => (
            <div key={event.id} className="rounded-xl border border-slate-100 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-slate-900">{event.type}</p>
                <p className="text-xs text-slate-500">{formatUkDateTime(event.createdAt)}</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {event.entityType ?? "event"} #{event.entityId ?? event.id}
                {event.siteId ? ` · site ${event.siteId}` : ""}
                {event.subjectUserId ? ` · user ${event.subjectUserId}` : ""}
              </p>
            </div>
          ))
        )}
      </div>
    </article>
  );
}
