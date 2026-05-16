"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";

export type ChartSegment = {
  id: string;
  label: string;
  value: number;
  color: string;
};

type DonutChartProps = {
  segments: ChartSegment[];
  size?: number;
  activeId?: string | null;
  onSelect?: (id: string | null) => void;
  emptyLabel?: string;
};

export function OverviewDonutChart({
  segments,
  size = 168,
  activeId,
  onSelect,
  emptyLabel = "No data",
}: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const gradient = useMemo(() => {
    if (total <= 0) return "conic-gradient(var(--portal-surface-muted) 0% 100%)";
    let acc = 0;
    const parts = segments
      .filter((s) => s.value > 0)
      .map((s) => {
        const pct = (s.value / total) * 100;
        const start = acc;
        acc += pct;
        return `${s.color} ${start}% ${acc}%`;
      });
    return `conic-gradient(${parts.join(", ")})`;
  }, [segments, total]);

  const focusId = hoverId ?? activeId ?? null;
  const focusSeg = segments.find((s) => s.id === focusId);

  if (total <= 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <div
          className="rounded-full border-2 border-dashed border-[var(--portal-border)]"
          style={{ width: size, height: size }}
        />
        <p className="text-sm text-[var(--portal-text-muted)]">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
      <button
        type="button"
        className="relative mx-auto shrink-0 rounded-full transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)]"
        style={{ width: size, height: size, background: gradient }}
        onClick={() => onSelect?.(activeId ? null : segments[0]?.id ?? null)}
        aria-label="Shift status chart"
      >
        <span className="absolute inset-[18%] flex flex-col items-center justify-center rounded-full bg-[var(--portal-surface)] text-center shadow-inner">
          <span className="font-display text-2xl font-bold tabular-nums text-[var(--portal-text)]">
            {focusSeg ? focusSeg.value : total}
          </span>
          <span className="max-w-[5rem] truncate text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">
            {focusSeg ? focusSeg.label : "Total"}
          </span>
        </span>
      </button>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {segments.map((seg) => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
          const active = focusId === seg.id;
          return (
            <li key={seg.id}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition",
                  active ? "bg-[var(--portal-highlight)]" : "hover:bg-[var(--portal-table-row-hover)]",
                )}
                onMouseEnter={() => setHoverId(seg.id)}
                onMouseLeave={() => setHoverId(null)}
                onClick={() => onSelect?.(activeId === seg.id ? null : seg.id)}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: seg.color }} />
                <span className="min-w-0 flex-1 truncate font-medium text-[var(--portal-text)]">{seg.label}</span>
                <span className="tabular-nums text-[var(--portal-text-muted)]">
                  {seg.value} <span className="text-xs">({pct}%)</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type BarChartProps = {
  items: Array<{ id: string; label: string; value: number; color?: string }>;
  activeId?: string | null;
  onSelect?: (id: string | null) => void;
  emptyLabel?: string;
};

export function OverviewBarChart({ items, activeId, onSelect, emptyLabel = "No data" }: BarChartProps) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const total = items.reduce((s, i) => s + i.value, 0);

  if (total <= 0) {
    return <p className="py-8 text-center text-sm text-[var(--portal-text-muted)]">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-2.5">
      {items.map((item) => {
        const pct = Math.max(item.value > 0 ? 8 : 0, Math.round((item.value / max) * 100));
        const active = activeId === item.id;
        return (
          <li key={item.id}>
            <button
              type="button"
              className={cn(
                "group w-full rounded-lg px-1 py-0.5 text-left transition",
                active && "bg-[var(--portal-highlight)]",
              )}
              onClick={() => onSelect?.(active ? null : item.id)}
            >
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium text-[var(--portal-text)]">{item.label}</span>
                <span className="shrink-0 tabular-nums font-semibold text-[var(--portal-text-muted)]">{item.value}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[var(--portal-surface-muted)]">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out group-hover:opacity-90"
                  style={{
                    width: `${pct}%`,
                    background: item.color ?? "var(--portal-accent)",
                  }}
                />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

type TimelineChartProps = {
  points: Array<{ id: string; label: string; sublabel?: string; value: number }>;
};

export function OverviewTimelineChart({ points }: TimelineChartProps) {
  const max = Math.max(...points.map((p) => p.value), 1);

  if (points.length === 0) {
    return <p className="py-6 text-center text-sm text-[var(--portal-text-muted)]">No recent activity.</p>;
  }

  return (
    <div className="flex h-32 items-end gap-1 sm:gap-1.5">
      {points.map((p) => {
        const h = Math.max(6, Math.round((p.value / max) * 100));
        return (
          <div
            key={p.id}
            className="group flex min-w-0 flex-1 flex-col items-center gap-1"
            title={`${p.label}${p.sublabel ? ` · ${p.sublabel}` : ""}`}
          >
            <div
              className="w-full max-w-[2.5rem] rounded-t-md bg-[var(--portal-accent)] opacity-80 transition group-hover:opacity-100"
              style={{ height: `${h}%` }}
            />
            <span className="hidden max-w-full truncate text-[0.6rem] font-medium text-[var(--portal-text-muted)] sm:block">
              {p.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
