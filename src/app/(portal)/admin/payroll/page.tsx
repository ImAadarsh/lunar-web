import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import {
  PortalPage,
  PortalPageHeader,
  PortalPageTableBody,
} from "@/components/portal/portal-page-layout";
import { PortalTabNav } from "@/components/portal/portal-tab-nav";
import { PortalModal } from "@/components/portal/portal-modal";
import { PortalTableToolbar } from "@/components/portal/portal-table-toolbar";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { filterByQuery } from "@/lib/portal-table";
import { formatUkDateRange, formatUkDateTime } from "@/lib/format-datetime";
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
    metaJson?: {
      baseGrossPence?: number;
      adjustmentPence?: number;
      overtimeHours?: number;
      overtimePence?: number;
      nightDifferentialPence?: number;
      weekendDifferentialPence?: number;
      pensionEmployeePence?: number;
      pensionEmployerPence?: number;
      payePence?: number;
      niEmployeePence?: number;
    } | null;
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
    filePath?: string | null;
    sentAt?: string | null;
    readAt?: string | null;
  }>;
};
type UsersResponse = { items: Array<{ id: number; email: string; role: string }> };

const BASE_PATH = "/admin/payroll";

type PayrollPageProps = {
  searchParams: Promise<{ runId?: string; tab?: string; q?: string; status?: string; userId?: string }>;
};

export default async function AdminPayrollPage({ searchParams }: PayrollPageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/forbidden");

  const params = await searchParams;
  const runId = Number(params.runId);
  const hasRun = Number.isFinite(runId) && runId > 0;
  const activeTab = !hasRun
    ? "runs"
    : params.tab === "payslips"
      ? "payslips"
      : params.tab === "runs"
        ? "runs"
        : "lines";

  const [runsRes, detailsRes, payslipsRes, usersRes] = await Promise.all([
    backendApiWithSession<PayrollRuns>("/payroll/runs", session),
    hasRun ? backendApiWithSession<PayrollDetails>(`/payroll/runs/${runId}`, session) : Promise.resolve(null),
    hasRun ? backendApiWithSession<Payslips>(`/payroll/runs/${runId}/payslips`, session) : Promise.resolve(null),
    backendApiWithSession<UsersResponse>("/users?role=guard&limit=200", session),
  ]);
  const allRuns = runsRes.data?.items ?? [];
  const details = detailsRes?.data ?? null;
  const allPayslips = payslipsRes?.data?.items ?? [];
  const users = usersRes.data?.items ?? [];
  const userEmailById = new Map(users.map((u) => [u.id, u.email]));

  const query = (params.q ?? "").trim();
  const statusFilter = (params.status ?? "").trim();
  const userIdFilter = Number(params.userId ?? "");

  let runs = allRuns;
  if (statusFilter && activeTab === "runs") {
    runs = runs.filter((run) => run.status === statusFilter);
  }
  runs = filterByQuery(runs, query, (run) =>
    [String(run.id), run.status, run.periodStart, run.periodEnd].join(" "),
  );

  const allLines = details?.lines ?? [];
  let lines = allLines;
  if (userIdFilter) {
    lines = lines.filter((line) => line.userId === userIdFilter);
  }
  lines = filterByQuery(lines, query, (line) =>
  [
    String(line.userId),
    userEmailById.get(line.userId) ?? "",
    String(line.hoursWorked),
    String(line.grossPence),
    String(line.netPence),
  ].join(" "),
  );

  let payslips = allPayslips;
  if (statusFilter && activeTab === "payslips") {
    payslips = payslips.filter((p) => p.status === statusFilter);
  }
  if (userIdFilter) {
    payslips = payslips.filter((p) => p.userId === userIdFilter);
  }
  payslips = filterByQuery(payslips, query, (p) =>
    [
      String(p.userId),
      userEmailById.get(p.userId) ?? "",
      p.status,
      String(p.payload.netPence ?? ""),
    ].join(" "),
  );
  const loadErrors = [
    apiErrorMessage("Payroll runs", runsRes),
    apiErrorMessage("Payroll run details", detailsRes),
    apiErrorMessage("Payslips", payslipsRes),
    apiErrorMessage("Guard users", usersRes),
  ];

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

  async function sendPayslipAction(formData: FormData) {
    "use server";
    const payslipId = Number(formData.get("payslipId"));
    if (!payslipId) return;
    await mutateBackend(`/payroll/payslips/${payslipId}/send`, "POST", {});
    revalidatePath("/admin/payroll");
  }

  const tabs = hasRun
    ? [
        { id: "runs", label: "Pay runs" },
        { id: "lines", label: "Payroll lines" },
        { id: "payslips", label: "Payslips" },
      ]
    : [{ id: "runs", label: "Pay runs" }];

  const tabPreserved = hasRun
    ? {
        runId: String(runId),
        q: params.q,
        status: statusFilter || undefined,
        userId: userIdFilter ? String(userIdFilter) : undefined,
      }
    : {
        q: params.q,
        status: statusFilter || undefined,
      };

  const payrollResetHref = hasRun
    ? `${BASE_PATH}?runId=${runId}&tab=${activeTab}`
    : `${BASE_PATH}?tab=runs`;

  const guardOptions = users.map((u) => ({ value: String(u.id), label: u.email }));

  const headerDescription = details
    ? `Run #${details.id} · ${details.status} · ${formatUkDateRange(details.periodStart, details.periodEnd)}`
    : `${runs.length} of ${allRuns.length} pay run${allRuns.length === 1 ? "" : "s"} · select a run to view lines and payslips`;

  const headerActions = (
    <>
      <PortalModal
        triggerLabel="Create Run"
        title="Create payroll run"
        description="Select the pay period to prepare payroll calculations."
        triggerClassName="lunar-btn-primary lunar-btn-sm"
      >
        <form action={createRunAction} className="space-y-3">
          <input name="periodStart" type="date" required className="lunar-input" />
          <input name="periodEnd" type="date" required className="lunar-input" />
          <button className="lunar-btn-primary w-full">Save payroll run</button>
        </form>
      </PortalModal>
      {details ? (
        <>
          <PortalModal
            triggerLabel="Add Adjustment"
            title="Pre-processing adjustment"
            description="Use positive pence for additions and negative pence for deductions."
            triggerClassName="lunar-btn-secondary lunar-btn-sm"
          >
            <form action={addAdjustmentAction} className="space-y-3">
              <input type="hidden" name="runId" value={String(details.id)} />
              <select name="userId" required className="lunar-input">
                <option value="">Select guard</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email}
                  </option>
                ))}
              </select>
              <select name="kind" defaultValue="correction" className="lunar-input">
                <option value="bonus">bonus</option>
                <option value="deduction">deduction</option>
                <option value="correction">correction</option>
                <option value="other">other</option>
              </select>
              <input
                name="amountPence"
                type="number"
                required
                placeholder="Amount in pence, e.g. 2500 or -1000"
                className="lunar-input"
              />
              <input name="reason" placeholder="Reason" className="lunar-input" />
              <button className="lunar-btn-primary w-full">Save adjustment</button>
            </form>
          </PortalModal>
          {details.status === "completed" ? (
            <form action={updatePayrollStatusAction}>
              <input type="hidden" name="runId" value={String(details.id)} />
              <input type="hidden" name="status" value="approved" />
              <button type="submit" className="lunar-btn-secondary lunar-btn-sm">
                Approve run
              </button>
            </form>
          ) : null}
          {details.status === "approved" ? (
            <form action={updatePayrollStatusAction}>
              <input type="hidden" name="runId" value={String(details.id)} />
              <input type="hidden" name="status" value="finalized" />
              <button type="submit" className="lunar-btn-primary lunar-btn-sm">
                Finalize & issue payslips
              </button>
            </form>
          ) : null}
        </>
      ) : null}
    </>
  );

  return (
    <PortalPage>
      <PortalPageHeader title="Payroll" description={headerDescription} actions={headerActions}>
        <ApiErrorNotice errors={loadErrors} />
        <PortalTabNav basePath={BASE_PATH} tabs={tabs} activeTab={activeTab} preserved={tabPreserved} />
        {activeTab === "runs" ? (
          <PortalTableToolbar
            basePath={BASE_PATH}
            preserved={{ tab: "runs" }}
            resetHref={payrollResetHref}
            fields={[
              {
                type: "search",
                placeholder: "Search run ID, period, status…",
                defaultValue: query,
              },
              {
                type: "select",
                name: "status",
                label: "Status",
                defaultValue: statusFilter,
                options: [
                  { value: "", label: "All statuses" },
                  { value: "draft", label: "Draft" },
                  { value: "processing", label: "Processing" },
                  { value: "completed", label: "Completed" },
                  { value: "approved", label: "Approved" },
                  { value: "finalized", label: "Finalized" },
                ],
              },
            ]}
          />
        ) : activeTab === "lines" && hasRun ? (
          <PortalTableToolbar
            basePath={BASE_PATH}
            preserved={{ tab: "lines", runId: String(runId) }}
            resetHref={payrollResetHref}
            fields={[
              {
                type: "search",
                placeholder: "Search guard, hours, amounts…",
                defaultValue: query,
              },
              {
                type: "select",
                name: "userId",
                label: "Guard",
                defaultValue: userIdFilter ? String(userIdFilter) : "",
                options: [{ value: "", label: "All guards" }, ...guardOptions],
              },
            ]}
          />
        ) : activeTab === "payslips" && hasRun ? (
          <PortalTableToolbar
            basePath={BASE_PATH}
            preserved={{ tab: "payslips", runId: String(runId) }}
            resetHref={payrollResetHref}
            fields={[
              {
                type: "search",
                placeholder: "Search guard, status, net pay…",
                defaultValue: query,
              },
              {
                type: "select",
                name: "status",
                label: "Status",
                defaultValue: statusFilter,
                options: [
                  { value: "", label: "All statuses" },
                  { value: "draft", label: "Draft" },
                  { value: "issued", label: "Issued" },
                  { value: "sent", label: "Sent" },
                  { value: "read", label: "Read" },
                ],
              },
              {
                type: "select",
                name: "userId",
                label: "Guard",
                defaultValue: userIdFilter ? String(userIdFilter) : "",
                options: [{ value: "", label: "All guards" }, ...guardOptions],
              },
            ]}
          />
        ) : null}
      </PortalPageHeader>

      <PortalPageTableBody>
        {activeTab === "runs" ? (
          <div className="lunar-table-wrap min-h-0 flex-1 overflow-auto rounded-none border-0 bg-transparent">
            <table className="portal-table min-w-[40rem]">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Period</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[var(--portal-text-muted)]">
                      {allRuns.length === 0
                        ? "No payroll runs yet. Use Create Run to start a pay period."
                        : "No pay runs match your filters."}
                    </td>
                  </tr>
                ) : (
                  runs.map((run) => (
                    <tr key={run.id}>
                      <td className="font-medium tabular-nums">#{run.id}</td>
                      <td>
                        {formatUkDateRange(run.periodStart, run.periodEnd)}
                      </td>
                      <td className="capitalize">{run.status}</td>
                      <td className="text-[var(--portal-text-muted)]">
                        {formatUkDateTime(run.createdAt)}
                      </td>
                      <td className="text-right">
                        <Link
                          href={`${BASE_PATH}?runId=${run.id}&tab=lines`}
                          className="lunar-btn-secondary lunar-btn-sm"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : activeTab === "lines" && details ? (
          <div className="lunar-table-wrap min-h-0 flex-1 overflow-auto rounded-none border-0 bg-transparent">
            <table className="portal-table min-w-[56rem]">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Hours</th>
                  <th>Adjustments</th>
                  <th>Gross</th>
                  <th>OT/Diff</th>
                  <th>PAYE/NI</th>
                  <th>Pension</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[var(--portal-text-muted)]">
                      {allLines.length === 0
                        ? "No payroll lines for this run."
                        : "No payroll lines match your filters."}
                    </td>
                  </tr>
                ) : null}
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td>{userEmailById.get(line.userId) ?? `User #${line.userId}`}</td>
                    <td>{line.hoursWorked}</td>
                    <td>£{((line.metaJson?.adjustmentPence ?? 0) / 100).toFixed(2)}</td>
                    <td>£{(line.grossPence / 100).toFixed(2)}</td>
                    <td className="text-xs text-[var(--portal-text-muted)]">
                      OT {line.metaJson?.overtimeHours ?? 0}h / £
                      {(
                        ((line.metaJson?.overtimePence ?? 0) +
                          (line.metaJson?.nightDifferentialPence ?? 0) +
                          (line.metaJson?.weekendDifferentialPence ?? 0)) /
                        100
                      ).toFixed(2)}
                    </td>
                    <td className="text-xs text-[var(--portal-text-muted)]">
                      £{(((line.metaJson?.payePence ?? 0) + (line.metaJson?.niEmployeePence ?? 0)) / 100).toFixed(2)}
                    </td>
                    <td className="text-xs text-[var(--portal-text-muted)]">
                      £{((line.metaJson?.pensionEmployeePence ?? 0) / 100).toFixed(2)}
                    </td>
                    <td>£{(line.netPence / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeTab === "payslips" ? (
          allPayslips.length === 0 ? (
            <p className="p-6 text-center text-sm text-[var(--portal-text-muted)]">
              Payslips are generated when a run is finalized.
            </p>
          ) : payslips.length === 0 ? (
            <p className="p-6 text-center text-sm text-[var(--portal-text-muted)]">
              No payslips match your filters.
            </p>
          ) : (
            <div className="lunar-table-wrap min-h-0 flex-1 overflow-auto rounded-none border-0 bg-transparent">
              <table className="portal-table min-w-[48rem]">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Status</th>
                    <th>Issued</th>
                    <th>Net</th>
                    <th>Lifecycle</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((payslip) => (
                    <tr key={payslip.id}>
                      <td>{userEmailById.get(payslip.userId) ?? `User #${payslip.userId}`}</td>
                      <td>{payslip.status}</td>
                      <td>{payslip.issuedAt ? formatUkDateTime(payslip.issuedAt) : "—"}</td>
                      <td>£{((payslip.payload.netPence ?? 0) / 100).toFixed(2)}</td>
                      <td className="text-xs text-[var(--portal-text-muted)]">
                        sent {payslip.sentAt ? formatUkDateTime(payslip.sentAt) : "—"} / read{" "}
                        {payslip.readAt ? formatUkDateTime(payslip.readAt) : "—"}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <a
                            href={`/api/portal/payslips/${payslip.id}/file`}
                            className="lunar-btn-secondary lunar-btn-sm"
                          >
                            Download
                          </a>
                          <form action={sendPayslipAction}>
                            <input type="hidden" name="payslipId" value={String(payslip.id)} />
                            <button className="lunar-btn-primary lunar-btn-sm">Send</button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <p className="p-6 text-center text-sm text-[var(--portal-text-muted)]">
            Select a pay run from the Pay runs tab.
          </p>
        )}
      </PortalPageTableBody>
    </PortalPage>
  );
}
