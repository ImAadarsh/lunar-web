import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarShiftsView } from "@/components/dashboard/calendar-shifts-view";
import { DateRangeFilterDrawer } from "@/components/dashboard/date-range-filter-drawer";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { PortalDataTable, type PortalDataTableColumn } from "@/components/portal/portal-data-table";
import { PortalModal } from "@/components/portal/portal-modal";
import {
  PortalPage,
  PortalPageHeader,
  PortalPageTableBody,
} from "@/components/portal/portal-page-layout";
import { PortalTabNav } from "@/components/portal/portal-tab-nav";
import { PortalTableToolbarDrawer } from "@/components/portal/portal-table-toolbar-drawer";
import { StatusBadge } from "@/components/portal/status-badge";
import { ManagerAssignShiftForm } from "@/components/shifts/manager-assign-shift-form";
import { ManagerGuardAvailabilityTable } from "@/components/shifts/manager-guard-availability-table";
import { ShiftDetailModal, type ShiftDetail } from "@/components/shifts/shift-detail-modal";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { formatUkDateTime } from "@/lib/format-datetime";
import {
  GUARD_RECHARGE_HOURS,
  guardAvailabilityLabel,
  mapApiAvailability,
  shiftDutyLabel,
  type GuardAvailabilityState,
} from "@/lib/guard-availability";
import { displayGuardName } from "@/lib/leave-month-stats";
import { filterUpcomingShifts } from "@/lib/overview-stats";
import { bulkShiftsAction } from "@/lib/shift-dashboard-actions";
import { buildTrainingBySite } from "@/lib/training-by-site";
import {
  compareNumbers,
  compareOptionalDates,
  compareStrings,
  filterByQuery,
  paginateRows,
  parsePortalPageSize,
  parseSortDir,
  type SortDirection,
} from "@/lib/portal-table";
import type { DashboardShiftRow } from "@/lib/dashboard-types";
import {
  buildMegaCalendarHref,
  forwardDashboardDateRange,
  parseDashboardPeriodSearchParams,
} from "@/lib/dashboard-period";
import { ukDateRangeToIsoBounds } from "@/lib/uk-datetime";
import { getSessionFromCookies } from "@/lib/server-session";

const BASE_PATH = "/manager/shifts";
const SHIFT_SORT_KEYS = ["id", "siteName", "guardName", "startsAt", "endsAt", "duty", "status"] as const;

type ShiftsResponse = {
  items: Array<{
    id: number;
    siteId: number;
    userId: number;
    startsAt: string;
    endsAt: string;
    status: string;
    dutyState?: string | null;
  }>;
};

type DutyRosterResponse = {
  items: Array<{
    userId: number;
    availability: {
      state: string;
      dutyState?: string | null;
      canAssign?: boolean;
      rechargingUntil?: string | null;
      lastShiftEndedAt?: string | null;
      duties?: Array<{ id?: number; startsAt: string; endsAt: string; status?: string }> | null;
    };
    primaryShift?: {
      id: number;
      siteId: number;
      siteName?: string | null;
      startsAt: string;
      endsAt: string;
      status: string;
    } | null;
    duties?: Array<{ id?: number; startsAt: string; endsAt: string; status?: string }> | null;
  }>;
};

type SitesResponse = { items: Array<{ id: number; name: string }> };
type UsersResponse = {
  items: Array<{ id: number; email: string; role: string; status: string; fullName?: string | null }>;
};
type TrainingAssignmentsResponse = {
  items: Array<{ userId: number; siteId: number }>;
};

type ShiftTableRow = ShiftDetail;

type ManagerShiftsPageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
    pageSize?: string;
    tab?: string;
    from?: string;
    to?: string;
    sort?: string;
    dir?: string;
    status?: string;
    siteId?: string;
    state?: string;
  }>;
};

type ShiftsTabId = "shifts" | "availability" | "calendar";

function resolveShiftsTab(tabParam: string | undefined): ShiftsTabId {
  if (tabParam === "availability" || tabParam === "calendar") return tabParam;
  return "shifts";
}

const availabilitySortOrder: Record<GuardAvailabilityState, number> = {
  available: 0,
  missed_duty: 1,
  assigned: 2,
  duty_not_started: 3,
  on_duty: 4,
  recharging: 5,
  disabled: 6,
};

function sortShiftRows(rows: ShiftTableRow[], sort: string, dir: SortDirection) {
  const copy = [...rows];
  copy.sort((a, b) => {
    switch (sort) {
      case "id":
        return compareNumbers(a.id, b.id, dir);
      case "siteName":
        return compareStrings(a.siteName, b.siteName, dir);
      case "guardName":
        return compareStrings(a.guardName, b.guardName, dir);
      case "startsAt":
        return compareOptionalDates(a.startsAt, b.startsAt, dir);
      case "endsAt":
        return compareOptionalDates(a.endsAt, b.endsAt, dir);
      case "duty":
        return compareStrings(a.dutyState ?? "", b.dutyState ?? "", dir);
      case "status":
        return compareStrings(a.status, b.status, dir);
      default:
        return compareOptionalDates(a.startsAt, b.startsAt, dir);
    }
  });
  return copy;
}

export default async function ManagerShiftsPage({ searchParams }: ManagerShiftsPageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!["admin", "supervisor"].includes(session.user.role)) redirect("/forbidden");
  const isAdmin = session.user.role === "admin";

  const params = await searchParams;
  const activeTab = resolveShiftsTab(params.tab);
  const periodParams = parseDashboardPeriodSearchParams(
    params,
    activeTab === "calendar" ? forwardDashboardDateRange : undefined,
  );
  const calendarBounds =
    activeTab === "calendar" ? ukDateRangeToIsoBounds(periodParams.from, periodParams.to) : null;
  const calendarShiftQuery = calendarBounds
    ? new URLSearchParams({ from: calendarBounds.from, to: calendarBounds.to })
    : null;

  const [shiftsRes, sitesRes, usersRes, trainingRes, dutyRosterRes] = await Promise.all([
    backendApiWithSession<ShiftsResponse>(
      calendarShiftQuery ? `/shifts?${calendarShiftQuery}` : "/shifts",
      session,
    ),
    backendApiWithSession<SitesResponse>("/sites?limit=1000", session),
    backendApiWithSession<UsersResponse>("/users?role=guard&limit=200", session),
    backendApiWithSession<TrainingAssignmentsResponse>("/training/assignments", session),
    backendApiWithSession<DutyRosterResponse>("/duty/roster", session),
  ]);

  const shifts = shiftsRes.data?.items ?? [];
  const sites = sitesRes.data?.items ?? [];
  const users = usersRes.data?.items ?? [];
  const trainingAssignments = trainingRes.data?.items ?? [];
  const trainingBySite = buildTrainingBySite(trainingAssignments);

  const loadErrors = [
    apiErrorMessage("Shifts", shiftsRes),
    apiErrorMessage("Sites", sitesRes),
    apiErrorMessage("Guard users", usersRes),
    apiErrorMessage("Training", trainingRes),
    apiErrorMessage("Duty roster", dutyRosterRes),
  ];

  const siteById = new Map(sites.map((s) => [s.id, s.name]));
  const userById = new Map(users.map((u) => [u.id, u]));

  /** userId → trained sites for Assign Now / ScheduleShiftModal on the availability tab. */
  const trainedSitesByUserId: Record<string, Array<{ siteId: number; siteName: string }>> = {};
  for (const row of trainingAssignments) {
    const key = String(row.userId);
    if (!trainedSitesByUserId[key]) trainedSitesByUserId[key] = [];
    trainedSitesByUserId[key].push({
      siteId: row.siteId,
      siteName: siteById.get(row.siteId) ?? `Site #${row.siteId}`,
    });
  }

  const rosterByUser = new Map((dutyRosterRes.data?.items ?? []).map((row) => [row.userId, row]));

  const guardRoster = users
    .map((guard) => {
      const rosterEntry = rosterByUser.get(guard.id);
      const availability = rosterEntry
        ? mapApiAvailability(
            rosterEntry.availability,
            rosterEntry.primaryShift,
            rosterEntry.duties ?? rosterEntry.availability.duties,
          )
        : mapApiAvailability({ state: "disabled", canAssign: false, rechargingUntil: null, lastShiftEndedAt: null });
      // For "assigned" the roster's primaryShift is the guard's next (upcoming) shift.
      const nextShift =
        availability.state === "assigned" && rosterEntry?.primaryShift
          ? {
              id: rosterEntry.primaryShift.id,
              siteId: rosterEntry.primaryShift.siteId,
              siteName:
                rosterEntry.primaryShift.siteName ??
                siteById.get(rosterEntry.primaryShift.siteId) ??
                `Site #${rosterEntry.primaryShift.siteId}`,
              startsAt: rosterEntry.primaryShift.startsAt,
              endsAt: rosterEntry.primaryShift.endsAt,
            }
          : null;
      return {
        id: guard.id,
        name: displayGuardName(guard.fullName, guard.email),
        email: guard.email,
        availability,
        nextShift,
      };
    })
    .sort(
      (a, b) =>
        availabilitySortOrder[a.availability.state] - availabilitySortOrder[b.availability.state] ||
        a.name.localeCompare(b.name),
    );

  const availableCount = guardRoster.filter((g) => g.availability.canAssign).length;
  const onDutyCount = guardRoster.filter((g) => g.availability.state === "on_duty").length;

  const guardPickerOptions = guardRoster.map(({ id, name, availability }) => ({
    userId: id,
    name,
    availability,
  }));

  const shiftRows: ShiftTableRow[] = shifts.map((shift) => {
    const user = userById.get(shift.userId);
    const email = user?.email ?? "";
    return {
      id: shift.id,
      siteId: shift.siteId,
      siteName: siteById.get(shift.siteId) ?? `Site #${shift.siteId}`,
      userId: shift.userId,
      guardName: displayGuardName(user?.fullName, email),
      guardEmail: email,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
      status: shift.status,
      dutyState: shift.dutyState,
    };
  });

  const statusFilter = (params.status ?? "").trim();
  const siteFilter = (params.siteId ?? "").trim();
  const sort = SHIFT_SORT_KEYS.includes(params.sort as (typeof SHIFT_SORT_KEYS)[number])
    ? (params.sort as string)
    : "startsAt";
  const dir = parseSortDir(params.dir);
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = parsePortalPageSize(params.pageSize);

  let filteredShifts = shiftRows;
  if (statusFilter === "upcoming") {
    filteredShifts = filterUpcomingShifts(filteredShifts);
  } else if (statusFilter) {
    filteredShifts = filteredShifts.filter((s) => s.status === statusFilter);
  }
  if (siteFilter) {
    filteredShifts = filteredShifts.filter((s) => String(s.siteId) === siteFilter);
  }
  filteredShifts = filterByQuery(filteredShifts, params.q ?? "", (row) =>
    [row.id, row.siteName, row.guardName, row.guardEmail, row.status, row.dutyState ?? ""].join(" "),
  );

  const sortedShifts = sortShiftRows(filteredShifts, sort, dir);
  const { slice: pageRows, totalCount, totalPages, currentPage } = paginateRows(sortedShifts, page, pageSize);

  const tableQuery = {
    tab: "shifts",
    q: params.q,
    status: statusFilter || undefined,
    siteId: siteFilter || undefined,
    sort,
    dir,
    pageSize,
  };

  const availStateFilter = (params.state ?? "").trim();
  let filteredGuardRoster = guardRoster;
  if (availStateFilter) {
    filteredGuardRoster = filteredGuardRoster.filter((g) => g.availability.state === availStateFilter);
  }
  filteredGuardRoster = filterByQuery(filteredGuardRoster, params.q ?? "", (g) =>
    [g.name, g.email, guardAvailabilityLabel(g.availability.state), g.availability.state, g.nextShift?.siteName ?? ""].join(
      " ",
    ),
  );

  const calendarRows: DashboardShiftRow[] = shiftRows.map((row) => ({
    id: row.id,
    siteId: row.siteId,
    siteName: row.siteName,
    userId: row.userId,
    guardName: row.guardName,
    userEmail: row.guardEmail,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    status: row.status,
    dutyState: row.dutyState,
  }));

  const megaCalendarHref = buildMegaCalendarHref(periodParams);

  const tabPreserved =
    activeTab === "shifts"
      ? {
          q: params.q,
          page: currentPage > 1 ? String(currentPage) : undefined,
          sort,
          dir,
          status: statusFilter || undefined,
          siteId: siteFilter || undefined,
        }
      : activeTab === "availability"
        ? {
            q: params.q,
            state: availStateFilter || undefined,
          }
        : activeTab === "calendar"
          ? {
              from: periodParams.from,
              to: periodParams.to,
            }
          : undefined;

  const assignShiftModal = (
    <PortalModal
      triggerLabel="Assign Shift"
      title="Assign shift"
      description={`Site first, then times, then trained guards free for that start. Recharging needs ${GUARD_RECHARGE_HOURS}h after the previous duty (completed or scheduled).`}
      triggerClassName="lunar-btn-primary lunar-btn-sm"
    >
      <ManagerAssignShiftForm
        sites={sites}
        guards={guardPickerOptions}
        trainingBySite={trainingBySite}
      />
    </PortalModal>
  );

  const headerFilters =
    activeTab === "calendar" ? (
      <DateRangeFilterDrawer
        basePath={BASE_PATH}
        from={periodParams.from}
        to={periodParams.to}
        hiddenParams={{ tab: "calendar" }}
        title="Calendar filters"
        description="Set the date range for the mega calendar grid."
      />
    ) : activeTab === "shifts" ? (
      <PortalTableToolbarDrawer
        basePath={BASE_PATH}
        title="Shift filters"
        description="Search and filter the shifts table."
        summary={
          [
            statusFilter === "upcoming" ? "Upcoming" : statusFilter || null,
            siteFilter ? siteById.get(Number(siteFilter)) ?? `Site #${siteFilter}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        preserved={{ tab: "shifts", sort, dir }}
        fields={[
          {
            type: "search",
            placeholder: "Search shift, site, guard, status…",
            defaultValue: params.q ?? "",
          },
          {
            type: "select",
            name: "status",
            label: "Status",
            defaultValue: statusFilter,
            options: [
              { value: "", label: "All statuses" },
              { value: "upcoming", label: "Upcoming" },
              { value: "scheduled", label: "Scheduled" },
              { value: "active", label: "Active" },
              { value: "completed", label: "Completed" },
              { value: "cancelled", label: "Cancelled" },
            ],
          },
          {
            type: "searchable-select",
            name: "siteId",
            label: "Site",
            defaultValue: siteFilter,
            emptyLabel: "All sites",
            searchPlaceholder: "Search sites…",
            options: sites.map((site) => {
              const trainedCount = trainingBySite[String(site.id)]?.length ?? 0;
              return {
                value: String(site.id),
                label: `(${trainedCount}) ${site.name}`,
              };
            }),
          },
        ]}
      />
    ) : activeTab === "availability" ? (
      <PortalTableToolbarDrawer
        basePath={BASE_PATH}
        title="Availability filters"
        description="Search guards and filter by availability status."
        summary={availStateFilter || undefined}
        preserved={{ tab: "availability" }}
        fields={[
          {
            type: "search",
            placeholder: "Search guard, email, status…",
            defaultValue: params.q ?? "",
          },
          {
            type: "select",
            name: "state",
            label: "Availability",
            defaultValue: availStateFilter,
            options: [
              { value: "", label: "All statuses" },
              { value: "available", label: "Available" },
              { value: "assigned", label: "Assigned" },
              { value: "duty_not_started", label: "Duty not started" },
              { value: "on_duty", label: "On duty" },
              { value: "missed_duty", label: "Missed duty" },
              { value: "recharging", label: "Recharging" },
              { value: "disabled", label: "Disabled" },
            ],
          },
        ]}
      />
    ) : null;

  const shiftColumns: PortalDataTableColumn<ShiftTableRow>[] = [
    {
      id: "id",
      label: "ID",
      sortable: true,
      render: (row) => <span className="font-medium">#{row.id}</span>,
    },
    {
      id: "siteName",
      label: "Site",
      sortable: true,
      render: (row) => (
        <Link href={`/manager/sites/${row.siteId}`} className="font-medium text-[var(--portal-link)] hover:underline">
          {row.siteName}
        </Link>
      ),
    },
    {
      id: "guardName",
      label: "Guard",
      sortable: true,
      render: (row) => (
        <div>
          <Link href={`/manager/guards/${row.userId}`} className="font-medium text-[var(--portal-link)] hover:underline">
            {row.guardName}
          </Link>
          {row.guardEmail ? <p className="text-xs text-[var(--portal-text-muted)]">{row.guardEmail}</p> : null}
        </div>
      ),
    },
    {
      id: "startsAt",
      label: "Start",
      sortable: true,
      render: (row) => formatUkDateTime(row.startsAt),
    },
    {
      id: "endsAt",
      label: "End",
      sortable: true,
      render: (row) => formatUkDateTime(row.endsAt),
    },
    {
      id: "duty",
      label: "Duty",
      sortable: true,
      render: (row) =>
        row.dutyState ? (
          <span className="lunar-badge-neutral">{shiftDutyLabel(row.dutyState)}</span>
        ) : (
          <span className="text-[var(--portal-text-muted)]">—</span>
        ),
    },
    {
      id: "status",
      label: "Status",
      sortable: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: "actions",
      label: "",
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (row) => (
        <ShiftDetailModal
          shift={row}
          sites={sites}
          guards={guardPickerOptions}
          trainingBySite={trainingBySite}
          isAdmin={isAdmin}
        />
      ),
    },
  ];

  return (
    <PortalPage>
      <PortalPageHeader
        title="Shifts"
        description={`Schedule guards · ${availableCount} assignable · ${onDutyCount} on duty`}
        actions={
          <>
            {headerFilters}
            {assignShiftModal}
          </>
        }
      >
        <ApiErrorNotice errors={loadErrors} />
        <PortalTabNav
          basePath={BASE_PATH}
          tabs={[
            { id: "shifts", label: "Shifts" },
            { id: "calendar", label: "Mega calendar" },
            { id: "availability", label: "Guard availability" },
          ]}
          activeTab={activeTab}
          preserved={tabPreserved}
        />
      </PortalPageHeader>

      <PortalPageTableBody>
        {activeTab === "calendar" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-[var(--portal-border)] px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <h3 className="portal-section-title">Mega view calendar</h3>
                <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
                  Click a shift block to view, edit, complete, cancel, or delete.
                </p>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-4">
              <CalendarShiftsView
                mode="site"
                from={periodParams.from}
                to={periodParams.to}
                shifts={calendarRows}
                emptyMessage="No shifts in this date range. Open Filters to adjust the dates or assign new shifts."
                embedded
                shiftDetail={{
                  sites,
                  guards: guardPickerOptions,
                  trainingBySite,
                  isAdmin,
                }}
              />
            </div>
          </div>
        ) : activeTab === "shifts" ? (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--portal-border)] bg-[var(--portal-table-row-hover)]/40 px-4 py-3">
              <p className="text-sm text-[var(--portal-text-muted)]">
                Need a site-wise overview of every guard? Use the mega calendar for the full grid.
              </p>
              <Link href={megaCalendarHref} className="lunar-btn-primary lunar-btn-sm shrink-0">
                Open mega calendar
              </Link>
            </div>
            <PortalDataTable
            basePath={BASE_PATH}
            query={tableQuery}
            columns={shiftColumns}
            rows={pageRows}
            rowKey={(r) => r.id}
            emptyMessage="No shifts match your filters."
            page={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={pageSize}
            sort={sort}
            dir={dir}
            minWidth="52rem"
            bulk={{
              formId: "shifts-bulk-form",
              action: bulkShiftsAction,
              getRowId: (r) => r.id,
              actions: [
                {
                  label: "Cancel selected",
                  name: "bulkAction",
                  value: "cancel",
                  variant: "secondary",
                  confirmMessage: "Cancel all selected shifts?",
                },
                {
                  label: "Delete selected",
                  name: "bulkAction",
                  value: "delete",
                  variant: "danger",
                  confirmMessage: "Permanently delete all selected shifts? This cannot be undone.",
                },
              ],
            }}
          />
          </>
        ) : (
          <ManagerGuardAvailabilityTable
            rows={filteredGuardRoster}
            trainedSitesByUserId={trainedSitesByUserId}
            isAdmin={isAdmin}
          />
        )}
      </PortalPageTableBody>
    </PortalPage>
  );
}
