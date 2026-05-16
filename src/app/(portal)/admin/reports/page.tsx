import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { PortalPage, PortalPageBody, PortalPageHeader } from "@/components/portal/portal-page-layout";
import { PortalModal } from "@/components/portal/portal-modal";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { formatUkDateTime } from "@/lib/format-datetime";
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
  outputFormat?: string;
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
  const loadErrors = [apiErrorMessage("Export job", jobRes)];

  async function queueExportAction(formData: FormData) {
    "use server";
    const type = String(formData.get("type") ?? "").trim();
    const outputFormat = String(formData.get("outputFormat") ?? "csv").trim();
    const siteId = String(formData.get("siteId") ?? "").trim();
    const from = String(formData.get("from") ?? "").trim();
    const to = String(formData.get("to") ?? "").trim();
    if (!type) return;
    const payload: Record<string, unknown> = {};
    if (siteId) payload.siteId = Number(siteId);
    if (from) payload.from = from;
    if (to) payload.to = to;
    const created = (await mutateBackend("/reports/exports", "POST", { type, outputFormat, params: payload })) as {
      id?: number;
    };
    revalidatePath("/admin/reports");
    if (created?.id) redirect(`/admin/reports?jobId=${created.id}`);
  }

  const headerActions = (
    <PortalModal
      triggerLabel="Queue Export"
      title="Queue export"
      description="Choose report type, file format, and optional date/site filters."
      triggerClassName="lunar-btn-primary lunar-btn-sm"
    >
      <form action={queueExportAction} className="space-y-3">
        <select name="type" required className="lunar-input" defaultValue="">
          <option value="" disabled>
            Select export type
          </option>
          {exportTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <select name="outputFormat" defaultValue="csv" className="lunar-input">
          <option value="csv">CSV</option>
          <option value="xlsx">Excel XLSX</option>
          <option value="pdf">PDF summary</option>
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input name="from" type="date" className="lunar-input" aria-label="From date" />
          <input name="to" type="date" className="lunar-input" aria-label="To date" />
        </div>
        <input name="siteId" type="number" placeholder="Optional siteId" className="lunar-input" />
        <button className="lunar-btn-primary w-full">Start Export</button>
      </form>
    </PortalModal>
  );

  return (
    <PortalPage>
      <PortalPageHeader
        title="Reports"
        description={
          job
            ? `Job #${job.id} · ${job.status} · ${job.type}`
            : "Queue async exports and download completed jobs."
        }
        actions={headerActions}
      >
        <ApiErrorNotice errors={loadErrors} />
        <p className="text-xs text-[var(--portal-text-muted)]">
          Date range is required for attendance, staffing utilization, and patrol compliance exports.
        </p>
      </PortalPageHeader>
      <PortalPageBody padded>
        <section className="lunar-card lunar-card-pad">
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
                <span className="font-semibold text-slate-900">Format:</span> {job.outputFormat ?? "csv"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Status:</span> {job.status}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Created:</span> {formatUkDateTime(job.createdAt)}
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
      </PortalPageBody>
    </PortalPage>
  );
}
