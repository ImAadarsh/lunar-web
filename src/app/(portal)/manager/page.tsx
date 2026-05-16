import { redirect } from "next/navigation";
import { ManagerOverviewDashboard } from "@/components/portal/manager-overview-dashboard";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { PortalPage, PortalPageBody, PortalPageHeader } from "@/components/portal/portal-page-layout";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { getSessionFromCookies } from "@/lib/server-session";

type KpiData = {
  onDutyGuards: number;
  openIncidents: number;
  activeSos: number;
  missedCheckpointsEstimate: number;
};

type ShiftList = {
  items: Array<{
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
  }>;
};

type LeaveList = {
  items: Array<{
    id: number;
    userEmail: string;
    guardName?: string | null;
    leaveType: string;
    startDate: string;
    endDate: string;
    status: string;
  }>;
};

type UserList = {
  items: Array<{ id: number; email: string; role: string; status: string }>;
};

type AuditList = {
  items: Array<{ id: number; action: string; createdAt: string; entityType: string }>;
};

export default async function ManagerOverviewPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!["admin", "supervisor"].includes(session.user.role)) redirect("/forbidden");

  const isAdmin = session.user.role === "admin";

  const [kpiRes, shiftsRes, leaveRes, usersRes, auditRes] = await Promise.all([
    backendApiWithSession<KpiData>("/dashboard/kpis", session),
    backendApiWithSession<ShiftList>("/shifts", session),
    backendApiWithSession<LeaveList>("/leave-requests?status=pending&limit=12", session),
    isAdmin ? backendApiWithSession<UserList>("/users?limit=10", session) : Promise.resolve(null),
    isAdmin ? backendApiWithSession<AuditList>("/audit-logs?limit=10", session) : Promise.resolve(null),
  ]);

  const shifts = shiftsRes.data?.items ?? [];
  const pendingLeave = leaveRes.data?.items ?? [];
  const users = usersRes?.data?.items ?? [];
  const audits = auditRes?.data?.items ?? [];

  const loadErrors = [
    apiErrorMessage("Dashboard KPIs", kpiRes),
    apiErrorMessage("Shifts", shiftsRes),
    apiErrorMessage("Pending leave", leaveRes),
    isAdmin && usersRes ? apiErrorMessage("Recent users", usersRes) : "",
    isAdmin && auditRes ? apiErrorMessage("Audit events", auditRes) : "",
  ].filter(Boolean);

  const upcomingShifts = [...shifts]
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, 50);

  return (
    <PortalPage>
      <PortalPageHeader
        title="Overview"
        description={
          isAdmin
            ? "Unified operations and platform snapshot — live duty, leave, users, and audit."
            : "Live operations snapshot for your sites and teams."
        }
      >
        <ApiErrorNotice errors={loadErrors} />
      </PortalPageHeader>
      <PortalPageBody card={false} scrollPage>
        <ManagerOverviewDashboard
          kpis={kpiRes.data ?? null}
          shifts={upcomingShifts}
          pendingLeave={pendingLeave}
          users={users}
          audits={audits}
          isAdmin={isAdmin}
        />
      </PortalPageBody>
    </PortalPage>
  );
}
