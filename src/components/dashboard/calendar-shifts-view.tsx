import Link from "next/link";
import { cn } from "@/lib/cn";
import { getDutyDate, shiftDutyLabel } from "@/lib/guard-availability";
import { UK_LOCALE, UK_TIME_ZONE } from "@/lib/format-datetime";
import { buildGuardCalendarHref, buildSiteCalendarHref } from "@/lib/dashboard-period";
import { formatDutyDateLabel } from "@/lib/week-schedule";
import type { DashboardShiftRow } from "@/lib/dashboard-types";

type CalendarShiftsViewProps = {
  /** Calendar mode — controls which side becomes a row in the grid. */
  mode: "guard" | "site";
  /** Inclusive `YYYY-MM-DD` start of the period. */
  from: string;
  /** Inclusive `YYYY-MM-DD` end of the period. */
  to: string;
  /** Shifts to plot — may extend slightly outside the [from, to] range; out-of-range days are ignored. */
  shifts: DashboardShiftRow[];
  /** Empty-state copy when there are no shifts in range. */
  emptyMessage: string;
};

type CalendarColumn = {
  key: string;
  date: Date;
  isWeekend: boolean;
  isToday: boolean;
  dayShort: string;
  dayNum: string;
  monthShort: string;
};

type CalendarShiftBlock = {
  shift: DashboardShiftRow;
  timeLabel: string;
  partLabel: string;
  dutyDayKey: string;
  dutyDayLabel: string;
};

type CalendarRow = {
  key: string;
  /** Row title (site name or guard name). */
  label: string;
  /** Optional link target (e.g. site or guard dashboard). */
  href?: string;
  /** Day-keyed map of shift blocks (YYYY-MM-DD → blocks). */
  cells: Record<string, CalendarShiftBlock[]>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Parse a `YYYY-MM-DD` string as a UTC midnight Date — keeps day arithmetic stable across DST. */
function parseDateKey(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Get the calendar day (`YYYY-MM-DD`) a given moment falls on in UK time. */
function ukDayKey(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: UK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${day}`;
}

/** Short UK time of day, e.g. `07:00`. */
function ukTimeShort(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(UK_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: UK_TIME_ZONE,
  }).format(d);
}

function isWeekendUk(date: Date): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: UK_TIME_ZONE,
    weekday: "short",
  }).format(date);
  return weekday === "Sat" || weekday === "Sun";
}

function buildColumns(fromKey: string, toKey: string): CalendarColumn[] {
  const start = parseDateKey(fromKey);
  const end = parseDateKey(toKey);
  if (!start || !end) return [];
  const todayKey = ukDayKey(new Date());
  const columns: CalendarColumn[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    const date = new Date(t);
    const key = `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
    const fmt = new Intl.DateTimeFormat(UK_LOCALE, {
      timeZone: "UTC",
      weekday: "short",
      day: "2-digit",
      month: "short",
    }).formatToParts(date);
    columns.push({
      key,
      date,
      isWeekend: isWeekendUk(date),
      isToday: key === todayKey,
      dayShort: fmt.find((p) => p.type === "weekday")?.value ?? "",
      dayNum: fmt.find((p) => p.type === "day")?.value ?? "",
      monthShort: fmt.find((p) => p.type === "month")?.value ?? "",
    });
  }
  return columns;
}

function shiftBlockTone(shift: DashboardShiftRow): string {
  if (shift.status === "cancelled") {
    return "border-[var(--portal-border)] bg-[var(--portal-table-row-hover)] text-[var(--portal-text-muted)] line-through";
  }
  switch (shift.dutyState) {
    case "on_duty":
      return "border-sky-300 bg-sky-100 text-sky-900";
    case "missed_duty":
      return "border-rose-300 bg-rose-100 text-rose-900";
    case "duty_not_started":
      return "border-orange-300 bg-orange-100 text-orange-900";
    case "assigned":
      return "border-violet-300 bg-violet-100 text-violet-900";
    default:
      break;
  }
  if (shift.status === "completed") {
    return "border-emerald-300 bg-emerald-50 text-emerald-900";
  }
  if (shift.status === "active") {
    return "border-sky-300 bg-sky-100 text-sky-900";
  }
  if (shift.status === "missed") {
    return "border-rose-300 bg-rose-100 text-rose-900";
  }
  return "border-indigo-300 bg-indigo-50 text-indigo-900";
}

/** Plot each shift on its duty day only (UK date of shift start). */
function blocksForShift(shift: DashboardShiftRow, dayKeys: Set<string>): Array<{ key: string; block: CalendarShiftBlock }> {
  const start = new Date(shift.startsAt);
  const end = new Date(shift.endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const dutyDayKey = getDutyDate(shift.startsAt) ?? ukDayKey(start);
  if (!dayKeys.has(dutyDayKey)) return [];

  const timeLabel = `${ukTimeShort(start)} – ${ukTimeShort(end)}`;
  const dutyDayLabel = formatDutyDateLabel(dutyDayKey);
  const endKey = ukDayKey(end);
  const spansMidnight = endKey !== dutyDayKey;
  const partLabel = spansMidnight
    ? `${ukTimeShort(start)} → ${ukTimeShort(end)} (+1d)`
    : timeLabel;

  return [
    {
      key: dutyDayKey,
      block: {
        shift,
        timeLabel,
        partLabel,
        dutyDayKey,
        dutyDayLabel,
      },
    },
  ];
}

function buildRows(mode: "guard" | "site", shifts: DashboardShiftRow[], dayKeys: Set<string>): CalendarRow[] {
  const rowMap = new Map<string, CalendarRow>();

  for (const shift of shifts) {
    const blocks = blocksForShift(shift, dayKeys);
    if (blocks.length === 0) continue;

    let rowKey: string;
    let label: string;
    let href: string | undefined;

    if (mode === "guard") {
      rowKey = `site-${shift.siteId ?? "0"}`;
      label = shift.siteName ?? (shift.siteId ? `Site #${shift.siteId}` : "Unknown site");
      href = shift.siteId ? buildSiteCalendarHref(shift.siteId) : undefined;
    } else {
      rowKey = `user-${shift.userId ?? "0"}`;
      label = shift.guardName ?? shift.userEmail ?? (shift.userId ? `Guard #${shift.userId}` : "Unknown guard");
      href = shift.userId ? buildGuardCalendarHref(shift.userId) : undefined;
    }

    let row = rowMap.get(rowKey);
    if (!row) {
      row = { key: rowKey, label, href, cells: {} };
      rowMap.set(rowKey, row);
    }
    for (const { key, block } of blocks) {
      (row.cells[key] ||= []).push(block);
    }
  }

  // Sort each cell's blocks chronologically so AM shifts render before PM shifts.
  const rows = Array.from(rowMap.values());
  for (const row of rows) {
    for (const key of Object.keys(row.cells)) {
      row.cells[key].sort(
        (a, b) => new Date(a.shift.startsAt).getTime() - new Date(b.shift.startsAt).getTime(),
      );
    }
  }

  rows.sort((a, b) => a.label.localeCompare(b.label));
  return rows;
}

export function CalendarShiftsView({ mode, from, to, shifts, emptyMessage }: CalendarShiftsViewProps) {
  const columns = buildColumns(from, to);
  const dayKeys = new Set(columns.map((c) => c.key));
  const rows = buildRows(mode, shifts, dayKeys);

  if (columns.length === 0) {
    return (
      <p className="portal-section-muted">
        Select a date range above to load the calendar view.
      </p>
    );
  }

  const rowLabel = mode === "guard" ? "Site" : "Guard";

  return (
    <div className="lunar-card lunar-card-pad">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="portal-section-title">Calendar view</h3>
          <p className="portal-section-muted mt-0.5">
            {mode === "guard"
              ? "Shifts grouped by site. Click a site name to open that site’s calendar."
              : "Shifts grouped by guard. Click a guard name to open their calendar."}
          </p>
        </div>
        <CalendarLegend />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--portal-border)]">
        <table className="calendar-grid w-full border-collapse text-xs">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-20 min-w-[160px] border-b border-r border-[var(--portal-border)] bg-[var(--portal-surface)] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]"
              >
                {rowLabel}
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "min-w-[110px] border-b border-r border-[var(--portal-border)] px-2 py-2 text-center align-middle font-semibold",
                    col.isWeekend ? "bg-[var(--portal-table-row-hover)]" : "bg-[var(--portal-surface)]",
                    col.isToday && "ring-1 ring-inset ring-[var(--portal-accent)]",
                  )}
                >
                  <div className="text-[10px] uppercase tracking-wide text-[var(--portal-text-muted)]">
                    {col.dayShort}
                  </div>
                  <div className="text-sm font-semibold text-[var(--portal-text)]">
                    {col.dayNum} {col.monthShort}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-3 py-8 text-center text-sm text-[var(--portal-text-muted)]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 max-w-[200px] border-b border-r border-[var(--portal-border)] bg-[var(--portal-surface)] px-3 py-2 text-left align-top text-sm font-semibold"
                  >
                    {row.href ? (
                      <Link href={row.href} className="portal-link">
                        {row.label}
                      </Link>
                    ) : (
                      <span className="text-[var(--portal-text)]">{row.label}</span>
                    )}
                  </th>
                  {columns.map((col) => {
                    const blocks = row.cells[col.key] ?? [];
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          "h-16 min-w-[110px] border-b border-r border-[var(--portal-border)] align-top",
                          col.isWeekend ? "bg-[var(--portal-table-row-hover)]/60" : undefined,
                          col.isToday && "bg-[var(--portal-accent)]/5",
                        )}
                      >
                        {blocks.length === 0 ? (
                          <div className="h-full w-full" aria-hidden />
                        ) : (
                          <div className="flex flex-col gap-1 p-1">
                            {blocks.map((block, idx) => (
                              <ShiftBlock key={`${block.shift.id}-${idx}`} block={block} mode={mode} />
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ShiftBlock({ block, mode }: { block: CalendarShiftBlock; mode: "guard" | "site" }) {
  const { shift, partLabel, timeLabel, dutyDayLabel } = block;
  const tone = shiftBlockTone(shift);
  const subtitle = mode === "guard" ? shift.siteName : (shift.guardName ?? shift.userEmail);
  const titleLines = [
    `Duty day: ${dutyDayLabel}`,
    subtitle,
    timeLabel,
    shift.status ? `Status: ${shift.status}` : null,
    shift.dutyState ? `Duty: ${shiftDutyLabel(shift.dutyState)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-md border px-1.5 py-1 text-[11px] leading-tight",
        tone,
      )}
      title={titleLines}
    >
      <span className="truncate text-[10px] font-semibold uppercase tracking-wide opacity-80">
        Duty · {dutyDayLabel}
      </span>
      <span className="truncate font-semibold">{subtitle ?? "—"}</span>
      <span className="tabular-nums">{partLabel}</span>
    </div>
  );
}

function CalendarLegend() {
  const items: Array<{ tone: string; label: string }> = [
    { tone: "border-slate-300 bg-slate-100 text-slate-800", label: "Duty day = start date" },
    { tone: "border-sky-300 bg-sky-100 text-sky-900", label: "On duty" },
    { tone: "border-violet-300 bg-violet-100 text-violet-900", label: "Assigned" },
    { tone: "border-orange-300 bg-orange-100 text-orange-900", label: "Not started" },
    { tone: "border-rose-300 bg-rose-100 text-rose-900", label: "Missed" },
    { tone: "border-emerald-300 bg-emerald-50 text-emerald-900", label: "Completed" },
    { tone: "border-indigo-300 bg-indigo-50 text-indigo-900", label: "Scheduled" },
  ];
  return (
    <ul className="flex flex-wrap gap-1.5 text-[11px] text-[var(--portal-text-muted)]">
      {items.map((it) => (
        <li
          key={it.label}
          className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-medium", it.tone)}
        >
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70" />
          {it.label}
        </li>
      ))}
    </ul>
  );
}
