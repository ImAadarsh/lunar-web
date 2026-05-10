import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { backendApiWithSession } from "@/lib/backend";
import { mutateBackend } from "@/lib/portal-mutations";
import { getSessionFromCookies } from "@/lib/server-session";

const exportTypes = [
  { value: "users", label: "User directory", requiresRange: false },
  { value: "audit_logs", label: "Audit logs", requiresRange: false },
  { value: "attendance", label: "Attendance sessions", requiresRange: true },
  { value: "incidents", label: "Incidents", requiresRange: false },
  { value: "sites", label: "Sites", requiresRange: false },
  { value: "staffing_utilization", label: "Staffing utilization", requiresRange: true },
  { value: "patrol_compliance", label: "Patrol compliance", requiresRange: true },
  { value: "payroll_variance", label: "Payroll variance", requiresRange: false },
];

type ExportJob = {
  id: number;
  status: string;
  type: string;
  createdAt: string;
  errorMessage?: string;
  downloadUrl?: string;
};

type ReportsPageProps = {
  searchParams: Promise<{ jobId?: string }>;
};

export default async function AdminReportsPage({ searchParams }: ReportsPageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/forbidden");

  const params = await searchParams;
  const jobId = Number(params.jobId);
  const jobRes = jobId
    ? await backendApiWithSession<ExportJob>(`/reports/exports/${jobId}`, session)
    : null;
  const job = jobRes?.data ?? null;

  async function queueExportAction(formData: FormData) {
    "use server";
    const type = String(formData.get("type") ?? "").trim();
    const siteId = String(formData.get("siteId") ?? "").trim();
    const from = String(formData.get("from") ?? "").trim();
    const to = String(formData.get("to") ?? "").trim();
    if (!type) return;
    const payload: Record<string, unknown> = {};
    if (siteId) payload.siteId = Number(siteId);
    if (from) payload.from = from;
    if (to) payload.to = to;
    const created = (await mutateBackend("/reports/exports", "POST", { type, params: payload })) as {
      id?: number;
    };
    revalidatePath("/admin/reports");
    if (created?.id) redirect(`/admin/reports?jobId=${created.id}`);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Queue export</h2>
        <p className="text-sm text-slate-500">Creates async report/export jobs on backend.</p>
        <form action={queueExportAction} className="mt-3 space-y-3">
          <select
            name="type"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
            defaultValue=""
          >
            <option value="" disabled>
              Select export type
            </option>
            {exportTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              name="from"
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
              aria-label="From date"
            />
            <input
              name="to"
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
              aria-label="To date"
            />
          </div>
          <input
            name="siteId"
            type="number"
            placeholder="Optional siteId"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
          />
          <button className="w-full rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lunar-800">
            Queue Export
          </button>
        </form>
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          Date range is required for attendance, staffing utilization, and patrol compliance exports.
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Export job status</h2>
        {!job ? (
          <p className="mt-2 text-sm text-slate-500">Queue an export to view job details here.</p>
        ) : (
          <div className="mt-3 space-y-3 text-sm">
            <p>
              <span className="font-semibold text-slate-900">Job:</span> #{job.id}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Type:</span> {job.type}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Status:</span> {job.status}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Created:</span>{" "}
              {new Date(job.createdAt).toLocaleString()}
            </p>
            {job.errorMessage ? (
              <p className="rounded-md border border-rose-200 bg-rose-50 p-2 text-rose-700">{job.errorMessage}</p>
            ) : null}
            {job.status === "done" ? (
              <Link
                href={`/api/portal/export-file/${job.id}`}
                className="inline-flex rounded-lg bg-lunar-700 px-3 py-2 font-semibold text-white hover:bg-lunar-800"
              >
                Download file
              </Link>
            ) : (
              <p className="text-slate-500">If status is queued/processing, refresh after a few seconds.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

