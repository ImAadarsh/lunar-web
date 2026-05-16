import Link from "next/link";
import { cn } from "@/lib/cn";
import { StatusBadge } from "@/components/portal/status-badge";
import { ShiftRowActions } from "@/components/dashboard/shift-row-actions";
import { formatUkRange } from "@/lib/format-datetime";
import { shiftDutyLabel } from "@/lib/guard-availability";
import type { DashboardShiftRow } from "@/lib/dashboard-types";

type DashboardShiftCardsProps = {
  shifts: DashboardShiftRow[];
  emptyMessage: string;
  showGuard?: boolean;
  showActions?: boolean;
  guardId?: number;
  siteId?: number;
};

function shiftCardTone(dutyState?: string | null) {
  if (dutyState === "duty_not_started") {
    return "border-[var(--portal-badge-warning-ring)] bg-[var(--portal-badge-warning-bg)]";
  }
  if (dutyState === "missed_duty") {
    return "border-[var(--portal-badge-danger-ring)] bg-[var(--portal-badge-danger-bg)]";
  }
  if (dutyState === "on_duty") {
    return "border-[var(--portal-badge-success-ring)] bg-[var(--portal-badge-success-bg)]";
  }
  return "border-[var(--portal-border)] bg-[var(--portal-surface)]";
}

export function DashboardShiftCards({
  shifts,
  emptyMessage,
  showGuard = false,
  showActions = false,
  guardId,
  siteId,
}: DashboardShiftCardsProps) {
  if (shifts.length === 0) {
    return <p className="portal-section-muted">{emptyMessage}</p>;
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {shifts.map((shift) => (
        <li key={shift.id} className={cn("rounded-xl border p-3 text-sm", shiftCardTone(shift.dutyState))}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-[var(--portal-text)]">
                {showGuard ? (
                  <Link href={`/manager/guards/${shift.userId}`} className="portal-link">
                    {shift.guardName ?? shift.userEmail ?? `Guard #${shift.userId}`}
                  </Link>
                ) : (
                  <Link href={`/manager/sites/${shift.siteId}`} className="portal-link">
                    {shift.siteName ?? `Site #${shift.siteId}`}
                  </Link>
                )}
              </p>
              <p className="mt-0.5 text-[var(--portal-text-muted)]">{formatUkRange(shift.startsAt, shift.endsAt)}</p>
            </div>
            <span className="text-xs text-[var(--portal-text-muted)]">#{shift.id}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {shift.dutyState ? (
                <span className="lunar-badge-neutral">{shiftDutyLabel(shift.dutyState)}</span>
              ) : null}
              <StatusBadge status={shift.status} />
            </div>
            {showActions ? (
              <ShiftRowActions
                shiftId={shift.id}
                status={shift.status}
                guardId={guardId ?? shift.userId}
                siteId={siteId ?? shift.siteId}
              />
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
