"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

type FeedTabId = "shifts" | "incidents" | "sos" | "telemetry";

type FeedTab = {
  id: FeedTabId;
  label: string;
  items: string[];
};

type CommandOperationsFeedsTabsProps = {
  shifts: string[];
  incidents: string[];
  sos: string[];
  telemetry: string[];
  shiftsTabLabel?: string;
};

export function CommandOperationsFeedsTabs({
  shifts,
  incidents,
  sos,
  telemetry,
  shiftsTabLabel = "Shifts",
}: CommandOperationsFeedsTabsProps) {
  const tabs: FeedTab[] = [
    { id: "shifts", label: shiftsTabLabel, items: shifts },
    { id: "incidents", label: "Open incidents", items: incidents },
    { id: "sos", label: "SOS queue", items: sos },
    { id: "telemetry", label: "Live telemetry", items: telemetry },
  ];

  const [activeId, setActiveId] = useState<FeedTabId>("shifts");
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  return (
    <article className="lunar-card lunar-card-pad flex min-h-[28rem] flex-col">
      <h3 className="portal-section-title">Operations queues</h3>
      <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
        Filtered shifts, incidents, SOS, and live guard positions for the selected window.
      </p>

      <nav
        className="mt-4 flex flex-wrap gap-1 border-b border-[var(--portal-border)] pb-px"
        aria-label="Operations queue tabs"
      >
        {tabs.map((tab) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveId(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-semibold transition",
                selected
                  ? "-mb-px border border-[var(--portal-border)] border-b-[var(--portal-surface)] bg-[var(--portal-surface)] text-[var(--portal-text)]"
                  : "text-[var(--portal-text-muted)] hover:bg-[var(--portal-table-row-hover)] hover:text-[var(--portal-text)]",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-xs font-bold tabular-nums",
                  selected
                    ? "bg-[var(--portal-accent)]/15 text-[var(--portal-accent)]"
                    : "bg-slate-100 text-slate-600",
                )}
              >
                {tab.items.length}
              </span>
            </button>
          );
        })}
      </nav>

      <div role="tabpanel" className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        {active.items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--portal-border)] bg-[var(--portal-table-row-hover)]/50 px-4 py-8 text-center text-sm text-[var(--portal-text-muted)]">
            No {active.label.toLowerCase()} in this period.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {active.items.map((item) => (
              <li
                key={`${active.id}-${item}`}
                className="rounded-lg border border-[var(--portal-border)] bg-[var(--portal-surface)] p-3 text-[var(--portal-text)]"
              >
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
