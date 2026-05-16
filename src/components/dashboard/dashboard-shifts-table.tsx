import Link from "next/link";
import { StatusBadge } from "@/components/portal/status-badge";
import { ShiftRowActions } from "@/components/dashboard/shift-row-actions";
import { formatUkDateTime } from "@/lib/format-datetime";
import { shiftDutyLabel } from "@/lib/guard-availability";
import type { DashboardShiftRow } from "@/lib/dashboard-types";

type DashboardShiftsTableProps = {
  shifts: DashboardShiftRow[];
  mode: "guard" | "site";
  guardId?: number;
  siteId?: number;
  emptyMessage: string;
};

export function DashboardShiftsTable({
  shifts,
  mode,
  guardId,
  siteId,
  emptyMessage,
}: DashboardShiftsTableProps) {
  return (
    <table className="portal-table">
      <thead>
        <tr>
          {mode === "site" ? <th>Guard</th> : <th>Site</th>}
          <th>Start</th>
          <th>End</th>
          <th>Duty</th>
          <th>Status</th>
          <th className="text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {shifts.length === 0 ? (
          <tr>
            <td colSpan={6} className="py-8 text-center text-[var(--portal-text-muted)]">
              {emptyMessage}
            </td>
          </tr>
        ) : null}
        {shifts.map((shift) => (
          <tr key={shift.id} className="align-top">
            <td>
              {mode === "site" ? (
                <Link href={`/manager/guards/${shift.userId}`} className="portal-link font-medium">
                  {shift.guardName ?? shift.userEmail}
                </Link>
              ) : (
                <Link href={`/manager/sites/${shift.siteId}`} className="portal-link font-medium">
                  {shift.siteName}
                </Link>
              )}
            </td>
            <td className="whitespace-nowrap">{formatUkDateTime(shift.startsAt)}</td>
            <td className="whitespace-nowrap">{formatUkDateTime(shift.endsAt)}</td>
            <td>
              {shift.dutyState ? (
                <span className="lunar-badge-neutral">{shiftDutyLabel(shift.dutyState)}</span>
              ) : (
                <span className="text-xs text-[var(--portal-text-muted)]">—</span>
              )}
            </td>
            <td>
              <StatusBadge status={shift.status} />
            </td>
            <td className="text-right">
              <ShiftRowActions
                shiftId={shift.id}
                status={shift.status}
                guardId={guardId ?? shift.userId}
                siteId={siteId ?? shift.siteId}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
