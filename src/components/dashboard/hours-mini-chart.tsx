import { formatHours, formatWorkDateLabel, type HoursDayRow } from "@/lib/dashboard-api";

export function HoursMiniChart({ rows }: { rows: HoursDayRow[] }) {
  const slice = rows.slice(0, 14).reverse();
  if (slice.length === 0) {
    return <p className="text-sm text-slate-500">No hours recorded in this period.</p>;
  }

  const max = Math.max(...slice.map((r) => Number(r.hours) || 0), 1);

  return (
    <div className="space-y-3">
      <div className="flex h-28 items-end gap-1.5 border-b border-slate-100 pb-1">
        {slice.map((row) => {
          const h = Number(row.hours) || 0;
          const pct = Math.max(4, Math.round((h / max) * 100));
          return (
            <div
              key={String(row.workDate)}
              className="group flex min-w-0 flex-1 flex-col items-center gap-1"
              title={`${formatWorkDateLabel(String(row.workDate))}: ${formatHours(row.hours)}`}
            >
              <div
                className="w-full max-w-[2rem] rounded-t bg-lunar-500/80 transition group-hover:bg-lunar-600"
                style={{ height: `${pct}%` }}
              />
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">Last {slice.length} days with recorded attendance</p>
    </div>
  );
}
