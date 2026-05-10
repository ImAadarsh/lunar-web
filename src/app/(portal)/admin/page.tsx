import { backendApiWithSession } from "@/lib/backend";
import { getSessionFromCookies } from "@/lib/server-session";
import { redirect } from "next/navigation";

type KpiData = {
  onDutyGuards: number;
  openIncidents: number;
  activeSos: number;
  missedCheckpointsEstimate: number;
};

type UserList = {
  items: Array<{ id: number; email: string; role: string; status: string; created_at?: string }>;
  total: number;
};

type AuditList = {
  items: Array<{ id: number; action: string; createdAt: string; entityType: string }>;
};

export default async function AdminPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/forbidden");

  const [kpiRes, usersRes, auditRes] = await Promise.all([
    backendApiWithSession<KpiData>("/dashboard/kpis", session),
    backendApiWithSession<UserList>("/users?limit=10", session),
    backendApiWithSession<AuditList>("/audit-logs?limit=8", session),
  ]);

  const kpi = kpiRes.data;
  const users = usersRes.data?.items ?? [];
  const audits = auditRes.data?.items ?? [];

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-4">
        <Stat title="On-duty guards" value={kpi?.onDutyGuards ?? "-"} />
        <Stat title="Open incidents" value={kpi?.openIncidents ?? "-"} />
        <Stat title="Active SOS" value={kpi?.activeSos ?? "-"} />
        <Stat title="Missed checkpoints" value={kpi?.missedCheckpointsEstimate ?? "-"} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Recent users</h2>
          <p className="text-sm text-slate-500">Quick view of latest user records from `/users`.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-slate-100">
                    <td className="py-2.5">{user.email}</td>
                    <td className="py-2.5">{user.role}</td>
                    <td className="py-2.5 capitalize">{user.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Latest audit events</h2>
          <p className="text-sm text-slate-500">Admin-only actions and operational change history.</p>
          <ul className="mt-4 space-y-2">
            {audits.map((audit) => (
              <li key={audit.id} className="rounded-lg border border-slate-100 p-3">
                <p className="text-sm font-medium text-slate-900">{audit.action}</p>
                <p className="text-xs text-slate-500">
                  {audit.entityType} • {new Date(audit.createdAt).toLocaleString()}
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

