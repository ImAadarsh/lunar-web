import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { PortalPage, PortalPageBody, PortalPageHeader } from "@/components/portal/portal-page-layout";
import { StatCard } from "@/components/ui/stat-card";
import { GuardIdentityHeader } from "@/components/dashboard/guard-identity-header";
import { FocusDashboardHeader } from "@/components/portal/focus-dashboard-header";
import { PortalTableCard } from "@/components/portal/portal-table-card";
import { GuardTrainedSitesTab } from "@/components/dashboard/guard-trained-sites-tab";
import { ScheduleShiftModal } from "@/components/dashboard/schedule-shift-modal";
import { AttendanceTimeline } from "@/components/dashboard/attendance-timeline";
import { DashboardAlerts } from "@/components/dashboard/dashboard-alerts";
import { DashboardQuickLinks } from "@/components/dashboard/dashboard-quick-links";
import { DashboardShiftCards } from "@/components/dashboard/dashboard-shift-cards";
import { DashboardShiftsTable } from "@/components/dashboard/dashboard-shifts-table";
import { DashboardTabNav } from "@/components/dashboard/dashboard-tab-nav";
import { HoursMiniChart } from "@/components/dashboard/hours-mini-chart";
import { DateRangeFilterBar } from "@/components/dashboard/date-range-filter-bar";
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
import type { DashboardAlert, RecentAttendanceRow, ShiftGroups } from "@/lib/dashboard-types";
import { formatUkDateTime } from "@/lib/format-datetime";
import { shiftDutyLabel } from "@/lib/guard-availability";
import { displayGuardName } from "@/lib/leave-month-stats";
import { buildDashboardQuery, parseDashboardPeriodSearchParams } from "@/lib/dashboard-period";
import { getSessionFromCookies } from "@/lib/server-session";

const GUARD_TABS = [
  { id: "overview", label: "Overview" },
  { id: "sites", label: "Trained sites" },
  { id: "shifts", label: "Shifts" },
  { id: "hours", label: "Hours" },
  { id: "attendance", label: "Attendance" },
] as const;

type GuardDashboardResponse = {
  user: {
    id: number;
    email: string;
    phone?: string | null;
    status: string;
    role: string;
    fullName?: string | null;
    siaNumber?: string | null;
    siaExpiryDate?: string | null;
  };
  period: { year: number; month: number | null; label: string };
  hours: { total: number; byDay: HoursDayRow[]; byMonth: HoursMonthRow[] };
  trainedSites: Array<{ siteId: number; siteName: string; trainedOn?: string | null }>;
  availability: BackendAvailability;
  currentShift: {
    id: number;
    siteId: number;
    siteName: string;
    startsAt: string;
    endsAt: string;
    status: string;
  } | null;
  shifts: Array<{
    id: number;
    siteId: number;
    siteName: string;
    startsAt: string;
    endsAt: string;
    status: string;
    dutyState?: string | null;
  }>;
  summary?: {
    upcoming: number;
    today: number;
    inProgress: number;
    missed: number;
    completed: number;
    cancelled: number;
    trainedSites: number;
    pendingLeave: number;
  };
  alerts?: DashboardAlert[];
  recentAttendance?: RecentAttendanceRow[];
  leave?: { pending: number; byStatus: Record<string, number> };
  shiftGroups?: ShiftGroups;
};

type GuardDashboardPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; year?: string; month?: string; tab?: string }>;
};

export default async function GuardDashboardPage({ params, searchParams }: GuardDashboardPageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!["admin", "supervisor"].includes(session.user.role)) redirect("/forbidden");

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) notFound();

  const sp = await searchParams;
  const periodParams = parseDashboardPeriodSearchParams(sp);
  const tab = GUARD_TABS.some((t) => t.id === sp.tab) ? sp.tab! : "overview";

  const basePath = `/manager/guards/${userId}`;
  const dashRes = await backendApiWithSession<GuardDashboardResponse>(
    `/dashboard/guards/${userId}?${buildDashboardQuery(periodParams)}`,
    session,
  );

  if (!dashRes.ok) {
    if (dashRes.status === 404) notFound();
    return (
      <PortalPage>
        <PortalPageHeader title="Guard dashboard" description="Unable to load guard operations." />
        <PortalPageBody padded>
          <ApiErrorNotice errors={[apiErrorMessage("Guard dashboard", dashRes)]} />
        </PortalPageBody>
      </PortalPage>
    );
  }

  const data = dashRes.data!;
  const guardName = displayGuardName(data.user.fullName, data.user.email);
  const availability = mapBackendAvailability(data.availability);
  const canAssign = availability.canAssign;
  const summary = data.summary ?? {
    upcoming: 0,
    today: 0,
    inProgress: 0,
    missed: 0,
    completed: 0,
    cancelled: 0,
    trainedSites: data.trainedSites.length,
    pendingLeave: 0,
  };
  const alerts = data.alerts ?? [];
  const shiftGroups = data.shiftGroups ?? { upcoming: [], today: [], inProgress: [], past: [] };
  const recentAttendance = data.recentAttendance ?? [];

  const hoursRows = data.hours.byMonth.length ? data.hours.byMonth : data.hours.byDay;
  const showByMonth = data.hours.byMonth.length > 0;

  const quickLinks = [
    { href: "/manager/training", label: "Training" },
    { href: "/manager/shifts", label: "All shifts" },
    { href: "/manager/leave", label: "Leave" },
    { href: "/manager/incidents", label: "Incidents" },
    { href: `/admin/users/${userId}`, label: "User profile" },
  ];

  return (
    <PortalPage>
      <FocusDashboardHeader>
        <div className="flex w-full max-w-4xl items-center gap-2 sm:gap-3">
          <GuardIdentityHeader
            variant="bar"
            name={guardName}
            email={data.user.email}
            phone={data.user.phone}
            status={data.user.status}
            availability={availability}
          />
          <ScheduleShiftModal
            userId={userId}
            canAssign={canAssign}
            trainedSites={data.trainedSites.map((s) => ({ siteId: s.siteId, siteName: s.siteName }))}
          />
        </div>
      </FocusDashboardHeader>
      <PortalPageHeader>
        <DateRangeFilterBar basePath={basePath} from={periodParams.from} to={periodParams.to} />
        <DashboardTabNav
          basePath={basePath}
          tabs={[...GUARD_TABS]}
          activeTab={tab}
          from={periodParams.from}
          to={periodParams.to}
        />
        {data.currentShift && availability.state !== "available" ? (
          <p
            className={`rounded-lg border px-3 py-2 text-sm ${
              availability.state === "on_duty"
                ? "border-sky-200 bg-sky-50 text-sky-900"
                : availability.state === "duty_not_started"
                  ? "border-orange-200 bg-orange-50 text-orange-900"
                  : availability.state === "missed_duty"
                    ? "border-rose-200 bg-rose-50 text-rose-900"
                    : availability.state === "assigned"
                      ? "border-violet-200 bg-violet-50 text-violet-900"
                      : "border-slate-200 bg-slate-50 text-slate-800"
            }`}
          >
            <span className="font-semibold">{shiftDutyLabel(availability.dutyState ?? availability.state)}</span>
            {" — "}
            <Link href={`/manager/sites/${data.currentShift.siteId}`} className="font-semibold underline">
              {data.currentShift.siteName}
            </Link>
            {availability.state === "assigned"
              ? ` · starts ${formatUkDateTime(data.currentShift.startsAt)}`
              : ` · until ${formatUkDateTime(data.currentShift.endsAt)}`}
          </p>
        ) : null}
      </PortalPageHeader>

      <PortalPageBody card={false}>
        {tab === "overview" ? (
          <div className="space-y-4">
            <DashboardQuickLinks links={quickLinks} />
            <DashboardAlerts alerts={alerts} />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Hours (period)" value={formatHours(data.hours.total)} hint={data.period.label} />
              <StatCard title="Today" value={summary.today} hint="Shifts touching today" />
              <StatCard title="Upcoming" value={summary.upcoming} hint="Scheduled ahead" />
              <StatCard
                title="Pending leave"
                value={summary.pendingLeave}
                hint="Awaiting approval"
                tone={summary.pendingLeave > 0 ? "critical" : "default"}
              />
            </div>
            <div className="space-y-4">
              <section className="lunar-card lunar-card-pad">
                <h3 className="portal-section-title">On duty / in progress</h3>
                <div className="mt-3">
                  <DashboardShiftCards
                    shifts={shiftGroups.inProgress}
                    emptyMessage="Not on an active shift right now."
                    showActions
                    guardId={userId}
                  />
                </div>
              </section>
              <section className="lunar-card lunar-card-pad">
                <h3 className="portal-section-title">Today&apos;s schedule</h3>
                <div className="mt-3">
                  <DashboardShiftCards
                    shifts={shiftGroups.today}
                    emptyMessage="No shifts scheduled for today."
                    showActions
                    guardId={userId}
                  />
                </div>
              </section>
              <section className="lunar-card lunar-card-pad">
                <h3 className="portal-section-title">Upcoming</h3>
                <div className="mt-3">
                  <DashboardShiftCards
                    shifts={shiftGroups.upcoming}
                    emptyMessage="No upcoming shifts."
                    showActions
                    guardId={userId}
                  />
                </div>
              </section>
            </div>
          </div>
        ) : null}

        {tab === "sites" ? (
          <GuardTrainedSitesTab
            sites={data.trainedSites}
            currentSiteId={data.currentShift?.siteId}
            siaNumber={data.user.siaNumber}
            siaExpiryDate={data.user.siaExpiryDate}
          />
        ) : null}

        {tab === "shifts" ? (
          <PortalTableCard
            fill
            className="min-h-0 flex-1"
            title="All shifts"
            description="Full history with duty status, cancel, and delete."
          >
            <DashboardShiftsTable
              shifts={data.shifts}
              mode="guard"
              guardId={userId}
              emptyMessage="No shifts scheduled yet."
            />
          </PortalTableCard>
        ) : null}

        {tab === "hours" ? (
          <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <section className="lunar-card lunar-card-pad">
              <h3 className="portal-section-title">
                {showByMonth ? "Hours by month" : "Hours by day"}
              </h3>
              <p className="portal-section-muted mt-0.5">{data.period.label}</p>
              <div className="lunar-table-wrap mt-4">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>{showByMonth ? "Month" : "Date"}</th>
                      <th>Hours</th>
                      <th>Sessions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hoursRows.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-[var(--portal-text-muted)]">
                          No attendance recorded for this period.
                        </td>
                      </tr>
                    ) : null}
                    {!showByMonth
                      ? (hoursRows as HoursDayRow[]).map((row) => (
                          <tr key={String(row.workDate)}>
                            <td>{formatWorkDateLabel(String(row.workDate))}</td>
                            <td className="tabular-nums">{formatHours(row.hours)}</td>
                            <td className="tabular-nums">{row.sessionCount}</td>
                          </tr>
                        ))
                      : (hoursRows as HoursMonthRow[]).map((row) => (
                          <tr key={`${row.year}-${row.month}`}>
                            <td>{formatMonthLabel(row.year, row.month)}</td>
                            <td className="tabular-nums">{formatHours(row.hours)}</td>
                            <td className="tabular-nums">{row.sessionCount}</td>
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

        {tab === "attendance" ? (
          <section className="lunar-card lunar-card-pad">
            <h3 className="portal-section-title">Recent check-ins</h3>
            <p className="portal-section-muted mt-0.5">Latest attendance sessions across all sites.</p>
            <div className="mt-4">
              <AttendanceTimeline rows={recentAttendance} />
            </div>
          </section>
        ) : null}
      </PortalPageBody>
    </PortalPage>
  );
}
