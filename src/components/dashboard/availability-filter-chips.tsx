"use client";

import { guardAvailabilityLabel } from "@/lib/guard-availability";
import { cn } from "@/lib/cn";

const CHIP_ORDER = [
  "available",
  "on_duty",
  "assigned",
  "duty_not_started",
  "missed_duty",
  "recharging",
  "disabled",
] as const;

const chipStyles: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-800 border-emerald-200",
  on_duty: "bg-sky-100 text-sky-900 border-sky-200",
  assigned: "bg-violet-100 text-violet-900 border-violet-200",
  duty_not_started: "bg-orange-100 text-orange-900 border-orange-200",
  missed_duty: "bg-rose-100 text-rose-900 border-rose-200",
  recharging: "bg-amber-100 text-amber-900 border-amber-200",
  disabled: "bg-slate-100 text-slate-600 border-slate-200",
};

const activeRing = "ring-2 ring-lunar-600 ring-offset-1";

type AvailabilityFilterChipsProps = {
  counts: Record<string, number>;
  value: string;
  onChange: (value: string) => void;
};

export function AvailabilityFilterChips({ counts, value, onChange }: AvailabilityFilterChipsProps) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const entries = CHIP_ORDER.filter((k) => (counts[k] ?? 0) > 0);

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by availability">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition",
          "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          value === "all" && activeRing,
        )}
      >
        All
        <span className="tabular-nums opacity-80">{total}</span>
      </button>
      {entries.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition hover:opacity-90",
            chipStyles[key] ?? chipStyles.disabled,
            value === key && activeRing,
          )}
        >
          {guardAvailabilityLabel(key)}
          <span className="tabular-nums opacity-80">{counts[key]}</span>
        </button>
      ))}
    </div>
  );
}
