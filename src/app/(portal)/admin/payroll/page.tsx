import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { backendApiWithSession } from "@/lib/backend";
import { mutateBackend } from "@/lib/portal-mutations";
import { getSessionFromCookies } from "@/lib/server-session";

type PayrollRuns = {
  items: Array<{
    id: number;
    periodStart: string;
    periodEnd: string;
    status: string;
    createdAt: string;
  }>;
};

type PayrollDetails = {
  id: number;
  status: string;
  periodStart: string;
  periodEnd: string;
  lines: Array<{
    id: number;
    userId: number;
    hoursWorked: number;
    grossPence: number;
    netPence: number;
    metaJson?: { baseGrossPence?: number; adjustmentPence?: number } | null;
  }>;
};
type Payslips = {
  items: Array<{
    id: number;
    userId: number;
    status: string;
    issuedAt?: string;
    payload: {
      hoursWorked?: number;
      grossPence?: number;
      netPence?: number;
      adjustmentPence?: number;
    };
  }>;
};
type UsersResponse = { items: Array<{ id: number; email: string; role: string }> };

type PayrollPageProps = {
  searchParams: Promise<{ runId?: string }>;
};

export default async function AdminPayrollPage({ searchParams }: PayrollPageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/forbidden");

  const params = await searchParams;
  const runId = Number(params.runId);
  const [runsRes, detailsRes, payslipsRes, usersRes] = await Promise.all([
    backendApiWithSession<PayrollRuns>("/payroll/runs", session),
    runId ? backendApiWithSession<PayrollDetails>(`/payroll/runs/${runId}`, session) : Promise.resolve(null),
    runId ? backendApiWithSession<Payslips>(`/payroll/runs/${runId}/payslips`, session) : Promise.resolve(null),
    backendApiWithSession<UsersResponse>("/users?role=guard&limit=200", session),
  ]);
  const runs = runsRes.data?.items ?? [];
  const details = detailsRes?.data ?? null;
  const payslips = payslipsRes?.data?.items ?? [];
  const users = usersRes.data?.items ?? [];

  async function createRunAction(formData: FormData) {
    "use server";
    const periodStart = String(formData.get("periodStart") ?? "");
    const periodEnd = String(formData.get("periodEnd") ?? "");
    if (!periodStart || !periodEnd) return;
    await mutateBackend("/payroll/runs", "POST", { periodStart, periodEnd });
    revalidatePath("/admin/payroll");
  }

  async function addAdjustmentAction(formData: FormData) {
    "use server";
    const currentRunId = Number(formData.get("runId"));
    const userId = Number(formData.get("userId"));
    const kind = String(formData.get("kind") ?? "other");
    const amountPence = Number(formData.get("amountPence"));
    const reason = String(formData.get("reason") ?? "").trim();
    if (!currentRunId || !userId || !Number.isFinite(amountPence)) return;
    await mutateBackend(`/payroll/runs/${currentRunId}/adjustments`, "POST", {
      userId,
      kind,
      amountPence,
      reason: reason || undefined,
    });
    revalidatePath("/admin/payroll");
  }

  async function updatePayrollStatusAction(formData: FormData) {
    "use server";
    const currentRunId = Number(formData.get("runId"));
    const status = String(formData.get("status") ?? "");
    if (!currentRunId || !["approved", "finalized"].includes(status)) return;
    await mutateBackend(`/payroll/runs/${currentRunId}/status`, "PATCH", { status });
    revalidatePath("/admin/payroll");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <section className="space-y-4">
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Create payroll run</h2>
          <form action={createRunAction} className="mt-3 space-y-3">
            <input
              name="periodStart"
              type="date"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
            />
            <input
              name="periodEnd"
              type="date"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
            />
            <button className="w-full rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lunar-800">
              Create Run
            </button>
          </form>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Recent runs</h3>
          <ul className="mt-3 space-y-2">
            {runs.map((run) => (
              <li key={run.id} className="rounded-lg border border-slate-100 p-3">
                <p className="text-sm font-medium text-slate-900">
                  Run #{run.id} • {run.periodStart} to {run.periodEnd}
                </p>
                <p className="text-xs text-slate-500">{run.status}</p>
                <Link href={`/admin/payroll?runId=${run.id}`} className="mt-2 inline-block text-xs font-semibold text-lunar-700 hover:underline">
                  View details
                </Link>
              </li>
            ))}
          </ul>
        </article>
        {details ? (
          <article className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Pre-processing adjustment</h3>
            <p className="text-sm text-slate-500">Use positive pence for additions and negative pence for deductions.</p>
            <form action={addAdjustmentAction} className="mt-3 space-y-3">
              <input type="hidden" name="runId" value={String(details.id)} />
              <select name="userId" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Select guard</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email}
                  </option>
                ))}
              </select>
              <select name="kind" defaultValue="correction" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="bonus">bonus</option>
                <option value="deduction">deduction</option>
                <option value="correction">correction</option>
                <option value="other">other</option>
              </select>
              <input name="amountPence" type="number" required placeholder="Amount in pence, e.g. 2500 or -1000" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input name="reason" placeholder="Reason" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button className="w-full rounded-lg border border-lunar-200 px-4 py-2 text-sm font-semibold text-lunar-700 hover:bg-lunar-50">
                Add Adjustment
              </button>
            </form>
          </article>
        ) : null}
      </section>

      <section className="space-y-4">
      <article className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Run details</h2>
        {!details ? (
          <p className="mt-2 text-sm text-slate-500">Select a payroll run to inspect detailed lines.</p>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-slate-700">
              Run #{details.id} ({details.status}) • {details.periodStart} - {details.periodEnd}
            </p>
            <div className="flex flex-wrap gap-2">
              {details.status === "completed" ? (
                <form action={updatePayrollStatusAction}>
                  <input type="hidden" name="runId" value={String(details.id)} />
                  <input type="hidden" name="status" value="approved" />
                  <button className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
                    Approve Run
                  </button>
                </form>
              ) : null}
              {details.status === "approved" ? (
                <form action={updatePayrollStatusAction}>
                  <input type="hidden" name="runId" value={String(details.id)} />
                  <input type="hidden" name="status" value="finalized" />
                  <button className="rounded-lg bg-lunar-700 px-3 py-2 text-sm font-semibold text-white hover:bg-lunar-800">
                    Finalize & Issue Payslips
                  </button>
                </form>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="pb-2">User</th>
                    <th className="pb-2">Hours</th>
                    <th className="pb-2">Adjustments</th>
                    <th className="pb-2">Gross</th>
                    <th className="pb-2">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {details.lines.map((line) => (
                    <tr key={line.id} className="border-t border-slate-100">
                      <td className="py-2.5">{line.userId}</td>
                      <td className="py-2.5">{line.hoursWorked}</td>
                      <td className="py-2.5">£{((line.metaJson?.adjustmentPence ?? 0) / 100).toFixed(2)}</td>
                      <td className="py-2.5">£{(line.grossPence / 100).toFixed(2)}</td>
                      <td className="py-2.5">£{(line.netPence / 100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </article>
      {details ? (
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Issued payslips</h2>
          {payslips.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Payslips are generated when a run is finalized.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="pb-2">User</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Issued</th>
                    <th className="pb-2">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((payslip) => (
                    <tr key={payslip.id} className="border-t border-slate-100">
                      <td className="py-2.5">{payslip.userId}</td>
                      <td className="py-2.5">{payslip.status}</td>
                      <td className="py-2.5">{payslip.issuedAt ? new Date(payslip.issuedAt).toLocaleString() : "-"}</td>
                      <td className="py-2.5">£{((payslip.payload.netPence ?? 0) / 100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      ) : null}
      </section>
    </div>
  );
}

