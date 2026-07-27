"use client";

import Link from "next/link";
import { ScheduleShiftModal } from "@/components/dashboard/schedule-shift-modal";
import { GuardAvailabilityBadge } from "@/components/portal/guard-availability-badge";
import { PortalClientDataTable, type PortalClientColumn } from "@/components/portal/portal-client-data-table";
import { formatUkDateTime } from "@/lib/format-datetime";
import { type GuardAvailabilityInfo } from "@/lib/guard-availability";
import { parseApiDateTime, UK_TIME_ZONE } from "@/lib/uk-datetime";

export type GuardNextShift = {
  id: number;
  siteId: number;
  siteName: string;
  startsAt: string;
  endsAt: string;
};

export type GuardAvailabilityRow = {
  id: number;
  name: string;
  email: string;
  availability: GuardAvailabilityInfo;
  nextShift?: GuardNextShift | null;
};

export type TrainedSiteOption = {
  siteId: number;
  siteName: string;
};

const ukDayFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: UK_TIME_ZONE,
});
const ukTimeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: UK_TIME_ZONE,
});

/** Compact UK window, e.g. `Mon 27 Jul, 9:00 am – 5:00 pm` (overnight repeats the end day). */
function formatShiftWindow(startsAt: string, endsAt: string): string {
  const start = parseApiDateTime(startsAt);
  const end = parseApiDateTime(endsAt);
  if (!start) return "—";
  const startLabel = `${ukDayFmt.format(start)}, ${ukTimeFmt.format(start)}`;
  if (!end) return startLabel;
  const endLabel =
    ukDayFmt.format(start) === ukDayFmt.format(end)
      ? ukTimeFmt.format(end)
      : `${ukDayFmt.format(end)}, ${ukTimeFmt.format(end)}`;
  return `${startLabel} – ${endLabel}`;
}

type ManagerGuardAvailabilityTableProps = {
  rows: GuardAvailabilityRow[];
  /** userId → trained sites for the schedule modal. */
  trainedSitesByUserId: Record<string, TrainedSiteOption[]>;
  isAdmin: boolean;
};

export function ManagerGuardAvailabilityTable({
  rows,
  trainedSitesByUserId,
  isAdmin,
}: ManagerGuardAvailabilityTableProps) {
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
      id: "nextShift",
      label: "Next shift",
      sortable: true,
      sortValue: (r) =>
        r.nextShift ? parseApiDateTime(r.nextShift.startsAt)?.getTime() ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER,
      render: (row) =>
        row.nextShift ? (
          <div className="min-w-0">
            <Link
              href={`/manager/sites/${row.nextShift.siteId}`}
              className="font-medium text-[var(--portal-link)] hover:underline"
            >
              {row.nextShift.siteName}
            </Link>
            <p className="whitespace-nowrap text-xs text-[var(--portal-text-muted)]">
              {formatShiftWindow(row.nextShift.startsAt, row.nextShift.endsAt)}
            </p>
          </div>
        ) : (
          <span className="text-[var(--portal-text-muted)]">—</span>
        ),
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
      id: "assign",
      label: "Assign",
      sortable: true,
      sortValue: (r) => (r.availability.state === "disabled" ? 1 : 0),
      render: (row) => {
        const trainedSites = trainedSitesByUserId[String(row.id)] ?? [];
        if (row.availability.state === "disabled") {
          return (
            <button
              type="button"
              disabled
              title="Guard account is disabled"
              aria-label="Assign Now unavailable: guard disabled"
              className="lunar-btn-secondary lunar-btn-sm cursor-not-allowed opacity-50"
            >
              Assign Now
            </button>
          );
        }
        return (
          <ScheduleShiftModal
            userId={row.id}
            canAssign={row.availability.canAssign}
            trainedSites={trainedSites}
            isAdmin={isAdmin}
            availability={row.availability}
            triggerLabel="Assign Now"
          />
        );
      },
    },
  ];

  return (
    <PortalClientDataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      emptyMessage="No guards match your filters."
      defaultSort="guard"
      minWidth="52rem"
    />
  );
}
