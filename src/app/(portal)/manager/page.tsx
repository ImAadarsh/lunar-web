import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { getSessionFromCookies } from "@/lib/server-session";
import { redirect } from "next/navigation";

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
    startsAt: string;
    endsAt: string;
    status: string;
  }>;
};

type LeaveList = {
  items: Array<{
    id: number;
    userEmail: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    status: string;
  }>;
};

export default async function ManagerPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!["admin", "supervisor"].includes(session.user.role)) redirect("/forbidden");

  const [kpiRes, shiftsRes, leaveRes] = await Promise.all([
    backendApiWithSession<KpiData>("/dashboard/kpis", session),
    backendApiWithSession<ShiftList>("/shifts", session),
    backendApiWithSession<LeaveList>("/leave-requests?status=pending&limit=8", session),
  ]);

  const shifts = shiftsRes.data?.items ?? [];
  const pendingLeave = leaveRes.data?.items ?? [];
  const loadErrors = [
    apiErrorMessage("Dashboard KPIs", kpiRes),
    apiErrorMessage("Shifts", shiftsRes),
    apiErrorMessage("Pending leave", leaveRes),
  ];

  return (
    <div className="space-y-4">
      <ApiErrorNotice errors={loadErrors} />
      <section className="grid gap-3 md:grid-cols-4">
        <Stat title="On-duty guards" value={kpiRes.data?.onDutyGuards ?? "-"} />
        <Stat title="Open incidents" value={kpiRes.data?.openIncidents ?? "-"} />
        <Stat title="Active SOS" value={kpiRes.data?.activeSos ?? "-"} />
        <Stat title="Pending leave requests" value={pendingLeave.length} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Upcoming shifts</h2>
          <p className="text-sm text-slate-500">Shift assignments and current statuses.</p>
          <ul className="mt-4 space-y-2">
            {shifts.slice(0, 10).map((shift) => (
              <li key={shift.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                <p className="font-medium text-slate-900">
                  Shift #{shift.id} • User {shift.userId} • Site {shift.siteId}
                </p>
                <p className="text-slate-600">
                  {new Date(shift.startsAt).toLocaleString()} - {new Date(shift.endsAt).toLocaleString()}
                </p>
                <p className="mt-1 inline-flex rounded bg-lunar-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-lunar-800">
                  {shift.status}
                </p>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Pending leave decisions</h2>
          <p className="text-sm text-slate-500">Manager approvals from `/leave-requests`.</p>
          <ul className="mt-4 space-y-2">
            {pendingLeave.map((item) => (
              <li key={item.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                <p className="font-medium text-slate-900">{item.userEmail}</p>
                <p className="text-slate-700">
                  {item.leaveType} • {item.startDate} to {item.endDate}
                </p>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-lunar-900">{value}</p>
    </div>
  );
}

