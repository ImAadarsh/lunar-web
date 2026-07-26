"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { PortalClientDataTable, type PortalClientColumn } from "@/components/portal/portal-client-data-table";
import { PortalTabNav } from "@/components/portal/portal-tab-nav";
import { PortalTableCard } from "@/components/portal/portal-table-card";
import { StatusBadge } from "@/components/portal/status-badge";
import { cn } from "@/lib/cn";
import { formatUkDateRange, formatUkDateTime, formatUkRange } from "@/lib/format-datetime";
import { shiftDutyLabel } from "@/lib/guard-availability";
import { displayGuardName } from "@/lib/leave-month-stats";

type ShiftRow = {
  id: number;
  userId: number;
  siteId: number;
  siteName?: string;
  userEmail?: string;
  guardName?: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  dutyState?: string | null;
};

type LeaveRow = {
  id: number;
  userEmail: string;
  guardName?: string | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: string;
};

type UserRow = {
  id: number;
  email: string;
  role: string;
  status: string;
};

type AuditRow = {
  id: number;
  action: string;
  createdAt: string;
  entityType: string;
};

type OverviewTab = "shifts" | "leave" | "users" | "audit";

const OVERVIEW_BASE_PATH = "/manager";

/** Coloured chip tone per shift — duty state first, then status. Assigned = orange. */
function shiftRowTone(shift: ShiftRow): string {
  if (shift.status === "cancelled") {
    return "border-[var(--portal-border)] bg-[var(--portal-table-row-hover)] text-[var(--portal-text-muted)] line-through";
  }
  switch (shift.dutyState) {
    case "on_duty":
      return "border-sky-300 bg-sky-100 text-sky-900";
    case "missed_duty":
      return "border-rose-300 bg-rose-100 text-rose-900";
    case "duty_not_started":
      return "border-amber-300 bg-amber-100 text-amber-900";
    case "assigned":
      return "border-orange-300 bg-orange-100 text-orange-900";
    default:
      break;
  }
  if (shift.status === "completed") {
    return "border-emerald-300 bg-emerald-50 text-emerald-900";
  }
  if (shift.status === "active") {
    return "border-sky-300 bg-sky-100 text-sky-900";
  }
  return "border-indigo-300 bg-indigo-50 text-indigo-900";
}

/** Status-only tone for the Status pill. */
function shiftStatusTone(status: string): string {
  switch (status) {
    case "completed":
      return "border-emerald-300 bg-emerald-50 text-emerald-900";
    case "active":
      return "border-sky-300 bg-sky-100 text-sky-900";
    case "missed":
      return "border-rose-300 bg-rose-100 text-rose-900";
    case "cancelled":
      return "border-[var(--portal-border)] bg-[var(--portal-table-row-hover)] text-[var(--portal-text-muted)]";
    default:
      return "border-indigo-300 bg-indigo-50 text-indigo-900";
  }
}

type ManagerOverviewTablesProps = {
  shifts: ShiftRow[];
  pendingLeave: LeaveRow[];
  users: UserRow[];
  audits: AuditRow[];
  isAdmin: boolean;
};

export function ManagerOverviewTables({
  shifts,
  pendingLeave,
  users,
  audits,
  isAdmin,
}: ManagerOverviewTablesProps) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const activeTab: OverviewTab = useMemo(() => {
    if (tabParam === "leave") return "leave";
    if (tabParam === "users" && isAdmin) return "users";
    if (tabParam === "audit" && isAdmin) return "audit";
    return "shifts";
  }, [tabParam, isAdmin]);

  const shiftColumns: PortalClientColumn<ShiftRow>[] = [
    {
      id: "site",
      label: "Site",
      sortable: true,
      sortValue: (r) => r.siteName ?? "",
      render: (shift) => (
        <Link href={`/manager/sites/${shift.siteId}?tab=calendar`} className="portal-link font-medium">
          {shift.siteName ?? `Site ${shift.siteId}`}
        </Link>
      ),
    },
    {
      id: "guard",
      label: "Guard",
      sortable: true,
      sortValue: (r) => displayGuardName(r.guardName, r.userEmail),
      render: (shift) => (
        <div>
          <Link href={`/manager/guards/${shift.userId}?tab=calendar`} className="portal-link font-medium">
            {displayGuardName(shift.guardName, shift.userEmail)}
          </Link>
          <p className="text-xs text-[var(--portal-text-muted)]">{shift.userEmail}</p>
        </div>
      ),
    },
    {
      id: "window",
      label: "Window",
      sortable: true,
      sortValue: (r) => r.startsAt,
      render: (r) => (
        <span
          className={cn(
            "inline-flex rounded-md border px-2 py-1 text-xs font-medium leading-snug",
            shiftRowTone(r),
          )}
        >
          {formatUkRange(r.startsAt, r.endsAt)}
        </span>
      ),
    },
    {
      id: "duty",
      label: "Duty",
      sortable: true,
      sortValue: (r) => r.dutyState ?? "",
      render: (r) =>
        r.dutyState ? (
          <span
            className={cn(
              "inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold",
              shiftRowTone(r),
            )}
          >
            {shiftDutyLabel(r.dutyState)}
          </span>
        ) : (
          "—"
        ),
    },
    {
      id: "status",
      label: "Status",
      sortable: true,
      sortValue: (r) => r.status,
      render: (r) => (
        <span
          className={cn(
            "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
            shiftStatusTone(r.status),
          )}
        >
          {r.status}
        </span>
      ),
    },
  ];

  const leaveColumns: PortalClientColumn<LeaveRow>[] = [
    {
      id: "guard",
      label: "Guard",
      sortable: true,
      sortValue: (r) => displayGuardName(r.guardName, r.userEmail),
      render: (item) => (
        <div>
          <p className="font-medium">{displayGuardName(item.guardName, item.userEmail)}</p>
          <p className="text-xs text-[var(--portal-text-muted)]">{item.userEmail}</p>
        </div>
      ),
    },
    { id: "type", label: "Type", sortable: true, sortValue: (r) => r.leaveType, render: (r) => <span className="capitalize">{r.leaveType}</span> },
    {
      id: "dates",
      label: "Dates",
      sortable: true,
      sortValue: (r) => r.startDate,
      render: (r) => (
        <span className="text-sm">
          {formatUkDateRange(r.startDate, r.endDate)}
        </span>
      ),
    },
    {
      id: "status",
      label: "Status",
      sortable: true,
      sortValue: (r) => r.status,
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      id: "action",
      label: "Action",
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: () => (
        <Link href="/manager/leave" className="portal-link text-xs">
          Review
        </Link>
      ),
    },
  ];

  const userColumns: PortalClientColumn<UserRow>[] = [
    { id: "email", label: "Email", sortable: true, sortValue: (r) => r.email, render: (r) => <span className="font-medium">{r.email}</span> },
    { id: "role", label: "Role", sortable: true, sortValue: (r) => r.role, render: (r) => <span className="capitalize">{r.role}</span> },
    {
      id: "status",
      label: "Status",
      sortable: true,
      sortValue: (r) => r.status,
      render: (r) => <StatusBadge status={r.status} />,
    },
  ];

  const auditColumns: PortalClientColumn<AuditRow>[] = [
    { id: "action", label: "Action", sortable: true, sortValue: (r) => r.action, render: (r) => <span className="font-medium">{r.action}</span> },
    { id: "entity", label: "Entity", sortable: true, sortValue: (r) => r.entityType, render: (r) => r.entityType },
    {
      id: "when",
      label: "When",
      sortable: true,
      sortValue: (r) => r.createdAt,
      render: (r) => <span className="text-sm text-[var(--portal-text-muted)]">{formatUkDateTime(r.createdAt)}</span>,
    },
  ];

  const tabs: Array<{ id: OverviewTab; label: string; count?: number }> = [
    { id: "shifts", label: "Shifts", count: shifts.length },
    { id: "leave", label: "Leave", count: pendingLeave.length },
    ...(isAdmin
      ? [
          { id: "users" as const, label: "Users", count: users.length },
          { id: "audit" as const, label: "Audit", count: audits.length },
        ]
      : []),
  ];

  const tabLabels = tabs.map((tab) => ({
    id: tab.id,
    label: tab.count !== undefined ? `${tab.label} (${tab.count})` : tab.label,
  }));

  return (
    <section className="flex min-h-[min(28rem,70vh)] flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--portal-text)]">Operations data</h2>
          <p className="text-sm text-[var(--portal-text-muted)]">
            Search, sort, and drill into live records.
          </p>
        </div>
      </div>
      <PortalTabNav basePath={OVERVIEW_BASE_PATH} tabs={tabLabels} activeTab={activeTab} />

      {activeTab === "shifts" ? (
        <PortalTableCard
          className="min-h-[min(28rem,70vh)]"
          fill
          wrapTable={false}
          title="Upcoming shifts"
          description="Search and sort scheduled assignments."
          actions={
            <Link
              href="/manager/shifts?tab=shifts&status=upcoming"
              className="lunar-btn-primary lunar-btn-sm shrink-0"
            >
              View all Upcoming Shifts
            </Link>
          }
        >
          <PortalClientDataTable
            columns={shiftColumns}
            rows={shifts}
            rowKey={(r) => r.id}
            emptyMessage="No upcoming shifts."
            searchPlaceholder="Search site, guard, status…"
            searchText={(r) =>
              [r.siteName, r.userEmail, r.guardName, r.status, r.dutyState].filter(Boolean).join(" ")
            }
            defaultSort="window"
            defaultDir="asc"
            minWidth="36rem"
          />
        </PortalTableCard>
      ) : null}

      {activeTab === "leave" ? (
        <PortalTableCard
          className="min-h-[min(28rem,70vh)]"
          fill
          wrapTable={false}
          title="Pending leave"
          description="Filter and sort requests awaiting approval."
        >
          <PortalClientDataTable
            columns={leaveColumns}
            rows={pendingLeave}
            rowKey={(r) => r.id}
            emptyMessage="No pending leave requests."
            searchPlaceholder="Search guard, type…"
            searchText={(r) => [r.userEmail, r.guardName, r.leaveType, r.status].filter(Boolean).join(" ")}
            defaultSort="dates"
            defaultDir="asc"
            minWidth="32rem"
          />
        </PortalTableCard>
      ) : null}

      {activeTab === "users" && isAdmin ? (
        <PortalTableCard
          className="min-h-[min(28rem,70vh)]"
          fill
          wrapTable={false}
          title="Recent users"
          description="Latest accounts from the directory."
        >
          <PortalClientDataTable
            columns={userColumns}
            rows={users}
            rowKey={(r) => r.id}
            emptyMessage="No users to display."
            searchPlaceholder="Search email, role…"
            searchText={(r) => [r.email, r.role, r.status].join(" ")}
            defaultSort="email"
          />
        </PortalTableCard>
      ) : null}

      {activeTab === "audit" && isAdmin ? (
        <PortalTableCard
          className="min-h-[min(28rem,70vh)]"
          fill
          wrapTable={false}
          title="Latest audit events"
          description="Administrative and operational changes."
        >
          <PortalClientDataTable
            columns={auditColumns}
            rows={audits}
            rowKey={(r) => r.id}
            emptyMessage="No audit events yet."
            searchPlaceholder="Search action, entity…"
            searchText={(r) => [r.action, r.entityType, r.createdAt].join(" ")}
            defaultSort="when"
            defaultDir="desc"
            minWidth="28rem"
          />
        </PortalTableCard>
      ) : null}
    </section>
  );
}
