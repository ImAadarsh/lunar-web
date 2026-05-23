import Link from "next/link";
import { StatusBadge } from "@/components/portal/status-badge";
import { formatUkDate, formatUkDateTime, formatUkTime } from "@/lib/format-datetime";
import { getDutyDate, shiftDutyLabel } from "@/lib/guard-availability";
import { buildGuardCalendarHref, buildSiteCalendarHref } from "@/lib/dashboard-period";
import { formatDutyDateLabel } from "@/lib/week-schedule";

export type ShiftQueueItem = {
  id: number;
  siteId: number;
  siteName: string;
  userId: number;
  guardName: string;
  startsAt: string;
  endsAt: string;
  status: string;
  dutyState?: string | null;
};

function shiftDurationLabel(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "";
  const hours = Math.round((end - start) / (60 * 60 * 1000) * 10) / 10;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

type ShiftQueueCardProps = {
  shift: ShiftQueueItem;
};

export function ShiftQueueCard({ shift }: ShiftQueueCardProps) {
  const dutyDay = getDutyDate(shift.startsAt);
  const dutyLabel = dutyDay ? formatDutyDateLabel(dutyDay) : formatUkDate(shift.startsAt);
  const duration = shiftDurationLabel(shift.startsAt, shift.endsAt);
  const dutyText = shift.dutyState ? shiftDutyLabel(shift.dutyState) : null;

  return (
    <article className="rounded-lg border border-[var(--portal-border)] bg-[var(--portal-surface)] p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">
            Shift #{shift.id}
            {duration ? <span className="normal-case tracking-normal"> · {duration}</span> : null}
          </p>
          <h4 className="mt-1 truncate text-base font-semibold text-[var(--portal-text)]">{shift.guardName}</h4>
          <p className="mt-0.5 text-sm text-[var(--portal-text-muted)]">
            <Link
              href={`/manager/sites/${shift.siteId}?tab=calendar`}
              className="font-medium text-[var(--portal-link)] hover:underline"
            >
              {shift.siteName}
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <StatusBadge status={shift.status} />
          {dutyText ? (
            <span className="rounded-full border border-[var(--portal-border)] bg-[var(--portal-table-row-hover)] px-2 py-0.5 text-xs font-medium text-[var(--portal-text)]">
              {dutyText}
            </span>
          ) : null}
        </div>
      </div>

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">Duty day</dt>
          <dd className="mt-0.5 font-medium text-[var(--portal-text)]">{dutyLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">Start</dt>
          <dd className="mt-0.5 text-[var(--portal-text)]">
            <span className="font-medium">{formatUkTime(shift.startsAt)}</span>
            <span className="text-[var(--portal-text-muted)]"> · {formatUkDate(shift.startsAt)}</span>
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">End</dt>
          <dd className="mt-0.5 text-[var(--portal-text)]">{formatUkDateTime(shift.endsAt)}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--portal-border)] pt-3">
        <Link
          href={buildSiteCalendarHref(shift.siteId)}
          className="lunar-btn-secondary lunar-btn-sm"
        >
          Site calendar
        </Link>
        <Link href={buildGuardCalendarHref(shift.userId)} className="lunar-btn-secondary lunar-btn-sm">
          Guard calendar
        </Link>
        <Link href={`/manager/guards/${shift.userId}`} className="lunar-btn-secondary lunar-btn-sm">
          Guard profile
        </Link>
      </div>
    </article>
  );
}
