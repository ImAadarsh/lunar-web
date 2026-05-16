import { guardAvailabilityLabel } from "@/lib/guard-availability";

const CHIP_ORDER = [
  "on_duty",
  "duty_not_started",
  "assigned",
  "available",
  "missed_duty",
  "recharging",
  "disabled",
] as const;

const chipStyles: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-800",
  on_duty: "bg-sky-100 text-sky-900",
  assigned: "bg-violet-100 text-violet-900",
  duty_not_started: "bg-orange-100 text-orange-900",
  missed_duty: "bg-rose-100 text-rose-900",
  recharging: "bg-amber-100 text-amber-900",
  disabled: "bg-slate-100 text-slate-600",
};

export function RosterSummaryChips({ counts }: { counts: Record<string, number> }) {
  const entries = CHIP_ORDER.filter((k) => (counts[k] ?? 0) > 0);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map((key) => (
        <span
          key={key}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${chipStyles[key] ?? chipStyles.disabled}`}
        >
          {guardAvailabilityLabel(key)}
          <span className="tabular-nums opacity-80">{counts[key]}</span>
        </span>
      ))}
    </div>
  );
}
