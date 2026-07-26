"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ManagerOverviewTables } from "@/components/portal/manager-overview-tables";
import {
  OverviewBarChart,
  OverviewDonutChart,
  OverviewTimelineChart,
} from "@/components/portal/overview-charts";
import { cn } from "@/lib/cn";
import {
  auditActivityTimeline,
  auditEntitySegments,
  shiftDutySegments,
  shiftStatusSegments,
  shiftsNextSevenDays,
} from "@/lib/overview-stats";

type KpiData = {
  onDutyGuards: number;
  openIncidents: number;
  activeSos: number;
  missedCheckpointsEstimate: number;
};

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

type UserRow = { id: number; email: string; role: string; status: string };
type AuditRow = { id: number; action: string; createdAt: string; entityType: string };

type ManagerOverviewDashboardProps = {
  kpis: KpiData | null;
  /** Full roster sample for charts (all statuses). */
  shifts: ShiftRow[];
  /** Future scheduled shifts only — feeds the Upcoming shifts table. */
  upcomingShifts: ShiftRow[];
  pendingLeave: LeaveRow[];
  users: UserRow[];
  audits: AuditRow[];
  isAdmin: boolean;
};

const QUICK_LINKS = [
  { href: "/manager/command-center", label: "Command Center" },
  { href: "/manager/shifts", label: "Shifts" },
  { href: "/manager/leave", label: "Leave" },
  { href: "/manager/incidents", label: "Incidents & SOS" },
  { href: "/manager/training", label: "Training" },
] as const;

function ChartPanel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overview-chart-panel lunar-card lunar-card-pad flex flex-col", className)}>
      <div className="shrink-0">
        <h3 className="portal-section-title">{title}</h3>
        {description ? <p className="portal-section-muted mt-0.5">{description}</p> : null}
      </div>
      <div className="mt-4 min-h-0 flex-1">{children}</div>
    </section>
  );
}

function KpiCard({
  title,
  value,
  hint,
  href,
  tone = "default",
  icon,
}: {
  title: string;
  value: string | number;
  hint: string;
  href: string;
  tone?: "default" | "critical" | "success";
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "overview-kpi-card group lunar-stat block transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)]",
        tone === "critical" && "[--portal-stat-value:var(--portal-badge-danger-text)]",
        tone === "success" && "[--portal-stat-value:var(--portal-badge-success-text)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="text-[0.65rem] font-bold uppercase tracking-[0.2em]"
            style={{ color: "var(--portal-stat-title)" }}
          >
            {title}
          </p>
          <p
            className="mt-2 font-display text-3xl font-bold tabular-nums tracking-tight sm:text-4xl"
            style={{ color: "var(--portal-stat-value)" }}
          >
            {value}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--portal-stat-hint)" }}>
            {hint}
          </p>
        </div>
        <span className="overview-kpi-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--portal-highlight)] text-[var(--portal-accent)] transition group-hover:scale-105">
          {icon}
        </span>
      </div>
      <span className="mt-3 inline-flex text-xs font-semibold text-[var(--portal-link)] opacity-0 transition group-hover:opacity-100">
        View details →
      </span>
    </Link>
  );
}

function IconShield() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 3 4 7v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V7l-8-4z" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 9v4m0 4h.01M10.29 3.86 2.82 17a2 2 0 0 0 1.71 3h14.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  );
}

function IconSos() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  );
}

function IconCheckpoint() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

export function ManagerOverviewDashboard({
  kpis,
  shifts,
  upcomingShifts,
  pendingLeave,
  users,
  audits,
  isAdmin,
}: ManagerOverviewDashboardProps) {
  const statusSegments = useMemo(() => shiftStatusSegments(shifts), [shifts]);
  const dutySegments = useMemo(() => shiftDutySegments(shifts), [shifts]);
  const weekBars = useMemo(() => shiftsNextSevenDays(shifts), [shifts]);
  const auditBars = useMemo(() => auditActivityTimeline(audits), [audits]);
  const auditEntities = useMemo(() => auditEntitySegments(audits), [audits]);

  const openIncidents = Number(kpis?.openIncidents ?? 0);
  const activeSos = Number(kpis?.activeSos ?? 0);

  return (
    <div className="overview-dashboard space-y-5 pb-2">
      <section className="overview-hero lunar-card-static overflow-hidden px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[var(--portal-accent)]">Operations</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-[var(--portal-text)] sm:text-2xl">
              Live command snapshot
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--portal-text-muted)]">
              Interactive view of coverage, incidents, and scheduling. Click chart segments to open the matching
              filtered shift views.
            </p>
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="Quick actions">
            {QUICK_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="lunar-btn-secondary lunar-btn-sm">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="On-duty guards"
          value={kpis?.onDutyGuards ?? "—"}
          hint="Active shift coverage"
          href="/manager/shifts"
          tone="success"
          icon={<IconShield />}
        />
        <KpiCard
          title="Open incidents"
          value={kpis?.openIncidents ?? "—"}
          hint="Requires attention"
          href="/manager/incidents"
          tone={openIncidents > 0 ? "critical" : "default"}
          icon={<IconAlert />}
        />
        <KpiCard
          title="Active SOS"
          value={kpis?.activeSos ?? "—"}
          hint="Live emergency signals"
          href="/manager/incidents"
          tone={activeSos > 0 ? "critical" : "default"}
          icon={<IconSos />}
        />
        <KpiCard
          title={isAdmin ? "Missed checkpoints" : "Pending leave"}
          value={isAdmin ? (kpis?.missedCheckpointsEstimate ?? "—") : pendingLeave.length}
          hint={isAdmin ? "Estimated gaps" : "Awaiting approval"}
          href={isAdmin ? "/admin/checkpoints" : "/manager/leave"}
          icon={<IconCheckpoint />}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
        <ChartPanel
          className="xl:col-span-4"
          title="Shift status"
          description="Click a status to open the filtered shifts table."
        >
          <OverviewDonutChart
            segments={statusSegments}
            hrefFor={(id) => `/manager/shifts?tab=shifts&status=${encodeURIComponent(id)}`}
            emptyLabel="No shifts in roster"
          />
        </ChartPanel>

        <ChartPanel
          className="xl:col-span-4"
          title="Duty breakdown"
          description="Click a duty state to open guard availability."
        >
          <OverviewBarChart
            items={dutySegments}
            hrefFor={(id) => `/manager/shifts?tab=availability&state=${encodeURIComponent(id)}`}
            emptyLabel="No duty states yet"
          />
        </ChartPanel>

        <ChartPanel
          className="xl:col-span-4"
          title="Next 7 days"
          description="Click a day to open it in the mega calendar."
        >
          <OverviewBarChart
            items={weekBars}
            hrefFor={(day) => `/manager/shifts?tab=calendar&from=${day}&to=${day}`}
            emptyLabel="No shifts in the next week"
          />
        </ChartPanel>

        {isAdmin ? (
          <>
            <ChartPanel
              className="md:col-span-2 xl:col-span-8"
              title="Audit pulse"
              description="Recent administrative activity by hour."
            >
              <OverviewTimelineChart points={auditBars} />
            </ChartPanel>
            <ChartPanel className="xl:col-span-4" title="Audit by entity" description="What changed recently.">
              <OverviewDonutChart segments={auditEntities} emptyLabel="No audit events" />
            </ChartPanel>
          </>
        ) : null}
      </section>

      <ManagerOverviewTables
        shifts={upcomingShifts}
        pendingLeave={pendingLeave}
        users={users}
        audits={audits}
        isAdmin={isAdmin}
      />
    </div>
  );
}
