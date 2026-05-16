"use client";

import { GuardAvailabilityBadge } from "@/components/portal/guard-availability-badge";
import { PortalClientDataTable, type PortalClientColumn } from "@/components/portal/portal-client-data-table";
import { formatUkDateTime } from "@/lib/format-datetime";
import type { GuardAvailabilityInfo } from "@/lib/guard-availability";

export type GuardAvailabilityRow = {
  id: number;
  name: string;
  email: string;
  availability: GuardAvailabilityInfo;
};

type ManagerGuardAvailabilityTableProps = {
  rows: GuardAvailabilityRow[];
};

function readyLabel(availability: GuardAvailabilityInfo) {
  if (availability.canAssign) return "Now";
  if (availability.state === "recharging" && availability.rechargingUntil) {
    return formatUkDateTime(availability.rechargingUntil);
  }
  if (availability.state === "missed_duty") return "Now (missed duty)";
  if (availability.state === "on_duty" || availability.state === "duty_not_started") {
    return "When current shift ends";
  }
  if (availability.state === "assigned") return "After upcoming shift";
  return "—";
}

export function ManagerGuardAvailabilityTable({ rows }: ManagerGuardAvailabilityTableProps) {
  const columns: PortalClientColumn<GuardAvailabilityRow>[] = [
    {
      id: "guard",
      label: "Guard",
      sortable: true,
      sortValue: (r) => r.name,
      render: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-[var(--portal-text-muted)]">{row.email}</p>
        </div>
      ),
    },
    {
      id: "status",
      label: "Status",
      sortable: true,
      sortValue: (r) => r.availability.state,
      render: (row) => <GuardAvailabilityBadge info={row.availability} />,
    },
    {
      id: "lastEnded",
      label: "Last duty ended",
      sortable: true,
      sortValue: (r) => r.availability.lastShiftEndedAt?.getTime() ?? 0,
      render: (row) =>
        row.availability.lastShiftEndedAt ? formatUkDateTime(row.availability.lastShiftEndedAt) : "—",
    },
    {
      id: "ready",
      label: "Ready for assignment",
      sortable: true,
      sortValue: (r) => readyLabel(r.availability),
      render: (row) => readyLabel(row.availability),
    },
  ];

  return (
    <PortalClientDataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      emptyMessage="No guards match your filters."
      defaultSort="guard"
      minWidth="40rem"
      pageSize={15}
    />
  );
}
