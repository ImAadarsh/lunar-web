import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarShiftsView } from "@/components/dashboard/calendar-shifts-view";
import { DateRangeFilterBar } from "@/components/dashboard/date-range-filter-bar";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { PortalDataTable, type PortalDataTableColumn } from "@/components/portal/portal-data-table";
import { PortalModal } from "@/components/portal/portal-modal";
import {
  PortalPage,
  PortalPageHeader,
  PortalPageTableBody,
} from "@/components/portal/portal-page-layout";
import { PortalTabNav } from "@/components/portal/portal-tab-nav";
import { PortalTableToolbar } from "@/components/portal/portal-table-toolbar";
import { StatusBadge } from "@/components/portal/status-badge";
import { ManagerGuardAvailabilityTable } from "@/components/shifts/manager-guard-availability-table";
import { ShiftDetailModal, type ShiftDetail } from "@/components/shifts/shift-detail-modal";
import { TrainedSiteGuardPicker } from "@/components/shifts/trained-site-guard-picker";
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
import { assignGuardShiftAction, bulkShiftsAction, updateShiftAction } from "@/lib/shift-dashboard-actions";
import { buildTrainingBySite } from "@/lib/training-by-site";
import {
  compareNumbers,
  compareOptionalDates,
  compareStrings,
  filterByQuery,
  paginateRows,
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
import { UkDateTimeHint } from "@/components/forms/uk-datetime-hint";
import { getSessionFromCookies } from "@/lib/server-session";

const BASE_PATH = "/manager/shifts";
const PAGE_SIZE = 15;
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
    };
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
  const trainingBySite = buildTrainingBySite(trainingRes.data?.items ?? []);

  const loadErrors = [
    apiErrorMessage("Shifts", shiftsRes),
    apiErrorMessage("Sites", sitesRes),
    apiErrorMessage("Guard users", usersRes),
    apiErrorMessage("Training", trainingRes),
    apiErrorMessage("Duty roster", dutyRosterRes),
  ];

  const siteById = new Map(sites.map((s) => [s.id, s.name]));
  const userById = new Map(users.map((u) => [u.id, u]));

  const dutyByUser = new Map(
    (dutyRosterRes.data?.items ?? []).map((row) => [row.userId, mapApiAvailability(row.availability)]),
  );

  const guardRoster = users
    .map((guard) => ({
      id: guard.id,
      name: displayGuardName(guard.fullName, guard.email),
      email: guard.email,
      availability:
        dutyByUser.get(guard.id) ??
        mapApiAvailability({ state: "disabled", canAssign: false, rechargingUntil: null, lastShiftEndedAt: null }),
    }))
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

  let filteredShifts = shiftRows;
  if (statusFilter) {
    filteredShifts = filteredShifts.filter((s) => s.status === statusFilter);
  }
  if (siteFilter) {
    filteredShifts = filteredShifts.filter((s) => String(s.siteId) === siteFilter);
  }
  filteredShifts = filterByQuery(filteredShifts, params.q ?? "", (row) =>
    [row.id, row.siteName, row.guardName, row.guardEmail, row.status, row.dutyState ?? ""].join(" "),
  );

  const sortedShifts = sortShiftRows(filteredShifts, sort, dir);
  const { slice: pageRows, totalCount, totalPages, currentPage } = paginateRows(sortedShifts, page, PAGE_SIZE);

  const tableQuery = {
    tab: "shifts",
    q: params.q,
    status: statusFilter || undefined,
    siteId: siteFilter || undefined,
    sort,
    dir,
  };

  const availStateFilter = (params.state ?? "").trim();
  let filteredGuardRoster = guardRoster;
  if (availStateFilter) {
    filteredGuardRoster = filteredGuardRoster.filter((g) => g.availability.state === availStateFilter);
  }
  filteredGuardRoster = filterByQuery(filteredGuardRoster, params.q ?? "", (g) =>
    [g.name, g.email, guardAvailabilityLabel(g.availability.state), g.availability.state].join(" "),
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
      description={`Pick a site first — only trained guards appear. Recharging guards need ${GUARD_RECHARGE_HOURS}h rest after duty.`}
      triggerClassName="lunar-btn-primary lunar-btn-sm"
    >
      <form action={assignGuardShiftAction} className="space-y-3">
        <TrainedSiteGuardPicker sites={sites} guards={guardPickerOptions} trainingBySite={trainingBySite} />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-[var(--portal-text-muted)]">
            Start (UK)
            <input name="startsAt" type="datetime-local" required className="mt-1 lunar-input" />
          </label>
          <label className="text-xs font-semibold text-[var(--portal-text-muted)]">
            End (UK)
            <input name="endsAt" type="datetime-local" required className="mt-1 lunar-input" />
          </label>
        </div>
        <UkDateTimeHint />
        <button className="lunar-btn-primary w-full">Save shift</button>
      </form>
    </PortalModal>
  );

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
          updateShiftAction={updateShiftAction}
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
        actions={assignShiftModal}
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
        {activeTab === "calendar" ? (
          <DateRangeFilterBar
            basePath={BASE_PATH}
            from={periodParams.from}
            to={periodParams.to}
            hiddenParams={{ tab: "calendar" }}
          />
        ) : null}
        {activeTab === "shifts" ? (
          <PortalTableToolbar
            basePath={BASE_PATH}
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
        ) : (
          <PortalTableToolbar
            basePath={BASE_PATH}
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
        )}
      </PortalPageHeader>

      <PortalPageTableBody>
        {activeTab === "calendar" ? (
          <div className="lunar-card lunar-card-pad space-y-4">
            <div>
              <h3 className="portal-section-title">Mega view calendar</h3>
              <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
                All sites and guards in one grid. Click a site row to open that site&apos;s calendar, or a shift block
                for guard details.
              </p>
            </div>
            <CalendarShiftsView
              mode="site"
              from={periodParams.from}
              to={periodParams.to}
              shifts={calendarRows}
              emptyMessage="No shifts in this date range. Adjust the dates above or assign new shifts."
            />
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
            pageSize={PAGE_SIZE}
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
          <ManagerGuardAvailabilityTable rows={filteredGuardRoster} />
        )}
      </PortalPageTableBody>
    </PortalPage>
  );
}
