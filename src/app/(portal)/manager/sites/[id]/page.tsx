import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { PortalPage, PortalPageBody, PortalPageHeader } from "@/components/portal/portal-page-layout";
import { StatCard } from "@/components/ui/stat-card";
import { AssignGuardModal } from "@/components/dashboard/assign-guard-modal";
import { CalendarShiftsView } from "@/components/dashboard/calendar-shifts-view";
import { DashboardAlerts } from "@/components/dashboard/dashboard-alerts";
import { DashboardQuickLinks } from "@/components/dashboard/dashboard-quick-links";
import { DashboardShiftCards } from "@/components/dashboard/dashboard-shift-cards";
import { DashboardShiftsTable } from "@/components/dashboard/dashboard-shifts-table";
import { DashboardTabNav } from "@/components/dashboard/dashboard-tab-nav";
import { HoursMiniChart } from "@/components/dashboard/hours-mini-chart";
import { DateRangeFilterBar } from "@/components/dashboard/date-range-filter-bar";
import { RosterSummaryChips } from "@/components/dashboard/roster-summary-chips";
import { SiteDetailsTab } from "@/components/dashboard/site-details-tab";
import { SiteIdentityHeader } from "@/components/dashboard/site-identity-header";
import { FocusDashboardHeader } from "@/components/portal/focus-dashboard-header";
import { PortalTableCard } from "@/components/portal/portal-table-card";
import { SiteTrainedGuardsSection } from "@/components/dashboard/site-trained-guards-section";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import {
  formatHours,
  formatMonthLabel,
  formatWorkDateLabel,
  mapBackendAvailability,
  type BackendAvailability,
  type HoursDayRow,
  type HoursMonthRow,
} from "@/lib/dashboard-api";
import type { DashboardAlert, ShiftGroups } from "@/lib/dashboard-types";
import { formatUkDateTime } from "@/lib/format-datetime";
import { shiftDutyLabel } from "@/lib/guard-availability";
import { displayGuardName } from "@/lib/leave-month-stats";
import {
  buildDashboardQuery,
  buildFocusTabHref,
  buildSiteCalendarHref,
  forwardDashboardDateRange,
  parseDashboardPeriodSearchParams,
} from "@/lib/dashboard-period";
import { getSessionFromCookies } from "@/lib/server-session";

const SITE_TABS = [
  { id: "overview", label: "Overview" },
  { id: "trained-guards", label: "Trained guards" },
  { id: "details", label: "Site details" },
  { id: "shifts", label: "Shifts" },
  { id: "calendar", label: "Calendar", resetDates: true },
  { id: "hours", label: "Hours" },
] as const;

type SiteTabId = (typeof SITE_TABS)[number]["id"];

type SiteDashboardResponse = {
  site: {
    id: number;
    name: string;
    address?: string | null;
    centerLat?: number;
    centerLng?: number;
    geofenceRadiusM?: number | null;
    isActive: number | boolean;
  };
  period: { year: number; month: number | null; label: string; from?: string | null; to?: string | null };
  hours: { total: number; byDay: HoursDayRow[]; byMonth: HoursMonthRow[] };
  onDutyNow: Array<{
    shiftId: number;
    userId: number;
    userEmail: string;
    guardName?: string | null;
    startsAt: string;
    endsAt: string;
    status: string;
  }>;
  trainedGuards: Array<{
    trainingId: number;
    userId: number;
    userEmail: string;
    guardName?: string | null;
    userStatus: string;
    trainedOn?: string | null;
    dutyHoursInPeriod?: number;
    availability: BackendAvailability;
  }>;
  shifts: Array<{
    id: number;
    userId: number;
    userEmail: string;
    guardName?: string | null;
    startsAt: string;
    endsAt: string;
    status: string;
    dutyState?: string | null;
  }>;
  summary?: {
    shiftsToday: number;
    upcoming: number;
    onDuty: number;
    openIncidents: number;
    checkpoints: number;
    trainedGuards: number;
    assignableGuards: number;
    dutyNotStarted: number;
    missedRecent: number;
  };
  rosterCounts?: Record<string, number>;
  alerts?: DashboardAlert[];
  coverageGaps?: Array<{
    shiftId: number;
    userId: number;
    guardName?: string | null;
    userEmail?: string;
    dutyState?: string | null;
    startsAt: string;
    endsAt: string;
  }>;
  shiftGroups?: ShiftGroups;
};

type UsersResponse = {
  items: Array<{ id: number; email: string; role: string; fullName?: string | null; status?: string }>;
};

type SiteDashboardPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; year?: string; month?: string; tab?: string }>;
};

function resolveSiteTab(tabParam: string | undefined): SiteTabId {
  const normalized = tabParam === "roster" ? "trained-guards" : tabParam;
  return SITE_TABS.some((t) => t.id === normalized) ? (normalized as SiteTabId) : "overview";
}

export default async function SiteDashboardPage({ params, searchParams }: SiteDashboardPageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!["admin", "supervisor"].includes(session.user.role)) redirect("/forbidden");

  const isAdmin = session.user.role === "admin";
  const { id } = await params;
  const siteId = Number(id);
  if (!Number.isInteger(siteId) || siteId <= 0) notFound();

  const sp = await searchParams;
  const tab = resolveSiteTab(sp.tab);
  const periodParams = parseDashboardPeriodSearchParams(
    sp,
    tab === "calendar" ? forwardDashboardDateRange : undefined,
  );

  const basePath = `/manager/sites/${siteId}`;
  const calendarHref = buildSiteCalendarHref(siteId);
  const shiftsTabHref = buildFocusTabHref(basePath, "shifts", periodParams);
  const dashRes = await backendApiWithSession<SiteDashboardResponse>(
    `/dashboard/sites/${siteId}?${buildDashboardQuery(periodParams)}`,
    session,
  );

  if (!dashRes.ok) {
    if (dashRes.status === 404) notFound();
    return (
      <PortalPage>
        <PortalPageHeader title="Site dashboard" description="Unable to load site operations." />
        <PortalPageBody padded>
          <ApiErrorNotice errors={[apiErrorMessage("Site dashboard", dashRes)]} />
        </PortalPageBody>
      </PortalPage>
    );
  }

  const data = dashRes.data!;
  const siteActive = Boolean(data.site.isActive);

  const trainedGuardOptions = data.trainedGuards.map((g) => ({
    userId: g.userId,
    label: displayGuardName(g.guardName, g.userEmail),
    availability: mapBackendAvailability(g.availability),
  }));

  const trainedUserIds = new Set(data.trainedGuards.map((g) => g.userId));
  let untrainedGuardOptions: Array<{ id: number; label: string }> = [];

  if (isAdmin) {
    const usersRes = await backendApiWithSession<UsersResponse>("/users?limit=500", session);
    const guards = (usersRes.data?.items ?? []).filter(
      (u) => u.role === "guard" && (u.status == null || u.status === "active"),
    );
    untrainedGuardOptions = guards
      .filter((g) => !trainedUserIds.has(g.id))
      .map((g) => ({
        id: g.id,
        label: displayGuardName(g.fullName, g.email),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  const trainedRows = data.trainedGuards.map((g) => ({
    trainingId: Number(g.trainingId),
    userId: g.userId,
    userEmail: g.userEmail,
    guardName: g.guardName,
    userStatus: g.userStatus,
    trainedOn: g.trainedOn,
    dutyHoursInPeriod: g.dutyHoursInPeriod ?? 0,
    availability: mapBackendAvailability(g.availability),
  }));

  const summary = data.summary ?? {
    shiftsToday: 0,
    upcoming: 0,
    onDuty: data.onDutyNow.length,
    openIncidents: 0,
    checkpoints: 0,
    trainedGuards: data.trainedGuards.length,
    assignableGuards: 0,
    dutyNotStarted: 0,
    missedRecent: 0,
  };
  const alerts = data.alerts ?? [];
  const shiftGroups = data.shiftGroups ?? { upcoming: [], today: [], inProgress: [], past: [] };
  const rosterCounts = data.rosterCounts ?? {};
  const coverageGaps = data.coverageGaps ?? [];

  const hoursRows = data.hours.byMonth.length ? data.hours.byMonth : data.hours.byDay;
  const showByMonth = data.hours.byMonth.length > 0;

  const quickLinks = [
    { href: "/manager/training", label: "Training" },
    { href: "/manager/shifts", label: "All shifts" },
    { href: `/admin/sites/${siteId}`, label: "Site settings" },
    { href: "/manager/incidents", label: "Incidents" },
    { href: "/manager/command-center", label: "Command center" },
  ];

  return (
    <PortalPage>
      <FocusDashboardHeader>
        <div className="flex w-full max-w-4xl items-center gap-2 sm:gap-3">
          <SiteIdentityHeader
            variant="bar"
            name={data.site.name}
            address={data.site.address}
            isActive={siteActive}
          />
          <AssignGuardModal siteId={siteId} guards={trainedGuardOptions} isAdmin={isAdmin} />
        </div>
      </FocusDashboardHeader>
      <PortalPageHeader>
        <DateRangeFilterBar basePath={basePath} from={periodParams.from} to={periodParams.to} />
        <DashboardTabNav
          basePath={basePath}
          tabs={[...SITE_TABS]}
          activeTab={tab}
          from={periodParams.from}
          to={periodParams.to}
        />
      </PortalPageHeader>

      <PortalPageBody card={false}>
        {tab === "overview" ? (
          <div className="space-y-4">
            <DashboardQuickLinks links={quickLinks} />
            <DashboardAlerts alerts={alerts} />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Hours at site" value={formatHours(data.hours.total)} hint={data.period.label} />
              <StatCard title="On duty now" value={summary.onDuty} hint="Checked in" tone="success" />
              <StatCard
                title="Open incidents"
                value={summary.openIncidents}
                hint="Needs attention"
                tone={summary.openIncidents > 0 ? "critical" : "default"}
              />
              <StatCard title="Checkpoints" value={summary.checkpoints} hint="Patrol points" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                title="Today&apos;s shifts"
                value={summary.shiftsToday}
                hint="Scheduled today · open shifts"
                href={shiftsTabHref}
              />
              <StatCard
                title="Assignable guards"
                value={summary.assignableGuards}
                hint={`of ${summary.trainedGuards} trained · open calendar`}
                href={calendarHref}
              />
              <StatCard
                title="Coverage gaps"
                value={summary.dutyNotStarted + summary.missedRecent}
                hint="Not started / missed"
                tone={summary.dutyNotStarted > 0 ? "critical" : "default"}
              />
            </div>
            {Object.keys(rosterCounts).length > 0 ? (
              <section className="lunar-card lunar-card-pad">
                <h3 className="portal-section-title">Roster snapshot</h3>
                <div className="mt-3">
                  <RosterSummaryChips counts={rosterCounts} calendarHref={calendarHref} />
                </div>
              </section>
            ) : null}
            {coverageGaps.length > 0 ? (
              <section className="lunar-card lunar-card-pad">
                <h3 className="text-base font-semibold text-rose-900">Coverage alerts</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {coverageGaps.map((gap) => (
                    <li
                      key={gap.shiftId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-100 bg-rose-50/50 px-3 py-2"
                    >
                      <Link href={`/manager/guards/${gap.userId}`} className="font-medium text-lunar-800 hover:underline">
                        {displayGuardName(gap.guardName, gap.userEmail)}
                      </Link>
                      <span className="text-xs font-semibold text-rose-800">
                        {shiftDutyLabel(gap.dutyState)} · {formatUkDateTime(gap.startsAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <div className="space-y-4">
              <section className="lunar-card lunar-card-pad">
                <h3 className="portal-section-title">On duty now</h3>
                {data.onDutyNow.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No guards checked in at this site.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {data.onDutyNow.map((row) => (
                      <li key={row.shiftId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                        <Link href={`/manager/guards/${row.userId}`} className="font-medium text-lunar-800 hover:underline">
                          {displayGuardName(row.guardName, row.userEmail)}
                        </Link>
                        <span className="text-xs text-slate-500">Until {formatUkDateTime(row.endsAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="lunar-card lunar-card-pad">
                <h3 className="portal-section-title">Today</h3>
                <div className="mt-3">
                  <DashboardShiftCards
                    shifts={shiftGroups.today}
                    emptyMessage="No shifts today."
                    showGuard
                    showActions
                    siteId={siteId}
                  />
                </div>
              </section>
              <section className="lunar-card lunar-card-pad">
                <h3 className="portal-section-title">Upcoming</h3>
                <div className="mt-3">
                  <DashboardShiftCards
                    shifts={shiftGroups.upcoming}
                    emptyMessage="No upcoming shifts."
                    showGuard
                    showActions
                    siteId={siteId}
                  />
                </div>
              </section>
            </div>
          </div>
        ) : null}

        {tab === "trained-guards" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <SiteTrainedGuardsSection
              siteId={siteId}
              guards={trainedRows}
              untrainedGuardOptions={untrainedGuardOptions}
              rosterCounts={rosterCounts}
              periodLabel={data.period.label}
              isAdmin={isAdmin}
            />
          </div>
        ) : null}

        {tab === "details" ? <SiteDetailsTab site={data.site} /> : null}

        {tab === "shifts" ? (
          <PortalTableCard
            fill
            className="min-h-0 flex-1"
            title="Shifts at this site"
            description="Manage schedule, duty state, cancel, and delete."
          >
            <DashboardShiftsTable
              shifts={data.shifts}
              mode="site"
              siteId={siteId}
              emptyMessage="No shifts scheduled at this site."
            />
          </PortalTableCard>
        ) : null}

        {tab === "calendar" ? (
          <CalendarShiftsView
            mode="site"
            from={periodParams.from}
            to={periodParams.to}
            shifts={data.shifts}
            emptyMessage="No shifts scheduled at this site in the selected date range."
          />
        ) : null}

        {tab === "hours" ? (
          <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <section className="lunar-card lunar-card-pad">
              <h3 className="portal-section-title">{showByMonth ? "Hours by month" : "Hours by day"}</h3>
              <p className="mt-0.5 text-sm text-slate-500">{data.period.label}</p>
              <div className="lunar-table-wrap mt-4">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">{showByMonth ? "Month" : "Date"}</th>
                      <th className="px-3 py-2">Hours</th>
                      <th className="px-3 py-2">Sessions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hoursRows.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-8 text-center text-slate-500">
                          No attendance recorded for this period.
                        </td>
                      </tr>
                    ) : null}
                    {!showByMonth
                      ? (hoursRows as HoursDayRow[]).map((row) => (
                          <tr key={String(row.workDate)} className="border-t border-slate-100">
                            <td className="px-3 py-2.5">{formatWorkDateLabel(String(row.workDate))}</td>
                            <td className="px-3 py-2.5 tabular-nums">{formatHours(row.hours)}</td>
                            <td className="px-3 py-2.5 tabular-nums">{row.sessionCount}</td>
                          </tr>
                        ))
                      : (hoursRows as HoursMonthRow[]).map((row) => (
                          <tr key={`${row.year}-${row.month}`} className="border-t border-slate-100">
                            <td className="px-3 py-2.5">{formatMonthLabel(row.year, row.month)}</td>
                            <td className="px-3 py-2.5 tabular-nums">{formatHours(row.hours)}</td>
                            <td className="px-3 py-2.5 tabular-nums">{row.sessionCount}</td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="lunar-card lunar-card-pad">
              <h3 className="portal-section-title">Trend</h3>
              <div className="mt-4">
                <HoursMiniChart rows={data.hours.byDay} />
              </div>
            </section>
          </div>
        ) : null}
      </PortalPageBody>
    </PortalPage>
  );
}
