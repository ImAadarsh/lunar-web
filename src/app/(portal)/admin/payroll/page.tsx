import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DeletePayrollRunForm } from "@/components/admin/delete-payroll-run-form";
import { PayrollLineAdjustForm } from "@/components/admin/payroll-line-adjust-form";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import {
  PortalPage,
  PortalPageHeader,
  PortalPageTableBody,
} from "@/components/portal/portal-page-layout";
import { PortalTabNav } from "@/components/portal/portal-tab-nav";
import { PortalModal } from "@/components/portal/portal-modal";
import { PortalTableToolbarDrawer } from "@/components/portal/portal-table-toolbar-drawer";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { filterByQuery } from "@/lib/portal-table";
import { formatUkDateRange, formatUkDateTime } from "@/lib/format-datetime";
import { displayGuardName } from "@/lib/leave-month-stats";
import { mutateBackend } from "@/lib/portal-mutations";
import { getSessionFromCookies } from "@/lib/server-session";

type PayrollRuns = {
  items: Array<{
    id: number;
    name?: string | null;
    periodStart: string;
    periodEnd: string;
    hoursSource?: "attendance" | "shifts";
    pensionEmployeePct?: number;
    pensionEmployerPct?: number;
    status: string;
    createdAt: string;
  }>;
};

type PayrollDetails = {
  id: number;
  name?: string | null;
  status: string;
  periodStart: string;
  periodEnd: string;
  hoursSource?: "attendance" | "shifts";
  pensionEmployeePct?: number;
  pensionEmployerPct?: number;
  lines: Array<{
    id: number;
    userId: number;
    userEmail?: string | null;
    fullName?: string | null;
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
type UsersResponse = {
  items: Array<{ id: number; email: string; role: string; fullName?: string | null }>;
};

const BASE_PATH = "/admin/payroll";

function hoursSourceLabel(source?: string | null) {
  return source === "shifts" ? "Completed shifts" : "Attendance";
}

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
    backendApiWithSession<UsersResponse>("/users?role=guard&limit=500", session),
  ]);
  const allRuns = runsRes.data?.items ?? [];
  const details = detailsRes?.data ?? null;
  const allPayslips = payslipsRes?.data?.items ?? [];
  const users = usersRes.data?.items ?? [];
  const userById = new Map(
    users.map((u) => [u.id, { email: u.email, fullName: u.fullName ?? null }] as const),
  );

  const lineUserLabel = (line: {
    userId: number;
    userEmail?: string | null;
    fullName?: string | null;
  }) => {
    if (line.fullName || line.userEmail) {
      return displayGuardName(line.fullName, line.userEmail ?? undefined);
    }
    const u = userById.get(line.userId);
    return displayGuardName(u?.fullName, u?.email ?? `User #${line.userId}`);
  };
  const lineUserEmail = (line: { userId: number; userEmail?: string | null }) =>
    line.userEmail ?? userById.get(line.userId)?.email ?? null;

  const query = (params.q ?? "").trim();
  const statusFilter = (params.status ?? "").trim();
  const userIdFilter = Number(params.userId ?? "");

  let runs = allRuns;
  if (statusFilter && activeTab === "runs") {
    runs = runs.filter((run) => run.status === statusFilter);
  }
  runs = filterByQuery(runs, query, (run) =>
    [String(run.id), run.name ?? "", run.status, run.periodStart, run.periodEnd].join(" "),
  );

  const allLines = details?.lines ?? [];
  let lines = allLines;
  if (userIdFilter) {
    lines = lines.filter((line) => line.userId === userIdFilter);
  }
  lines = filterByQuery(lines, query, (line) =>
    [
      String(line.userId),
      lineUserLabel(line),
      lineUserEmail(line) ?? "",
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
  payslips = filterByQuery(payslips, query, (p) => {
    const u = userById.get(p.userId);
    return [
      String(p.userId),
      displayGuardName(u?.fullName, u?.email),
      u?.email ?? "",
      p.status,
      String(p.payload.netPence ?? ""),
    ].join(" ");
  });
  const loadErrors = [
    apiErrorMessage("Payroll runs", runsRes),
    apiErrorMessage("Payroll run details", detailsRes),
    apiErrorMessage("Payslips", payslipsRes),
    apiErrorMessage("Guard users", usersRes),
  ];

  async function createRunAction(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    const periodStart = String(formData.get("periodStart") ?? "");
    const periodEnd = String(formData.get("periodEnd") ?? "");
    const hoursSourceRaw = String(formData.get("hoursSource") ?? "attendance");
    const hoursSource = hoursSourceRaw === "shifts" ? "shifts" : "attendance";
    const pensionEmployeePct = Number(formData.get("pensionEmployeePct") ?? 5);
    const pensionEmployerPct = Number(formData.get("pensionEmployerPct") ?? 3);
    if (!name || !periodStart || !periodEnd) return;
    await mutateBackend("/payroll/runs", "POST", {
      name,
      periodStart,
      periodEnd,
      hoursSource,
      pensionEmployeePct: Number.isFinite(pensionEmployeePct) ? pensionEmployeePct : 5,
      pensionEmployerPct: Number.isFinite(pensionEmployerPct) ? pensionEmployerPct : 3,
    });
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

  async function reprocessPayrollRunAction(formData: FormData) {
    "use server";
    const currentRunId = Number(formData.get("runId"));
    if (!currentRunId) return;
    await mutateBackend(`/payroll/runs/${currentRunId}/reprocess`, "POST", {});
    revalidatePath("/admin/payroll");
  }

  async function deletePayrollRunAction(formData: FormData) {
    "use server";
    const currentRunId = Number(formData.get("runId"));
    if (!currentRunId) return;
    await mutateBackend(`/payroll/runs/${currentRunId}`, "DELETE");
    revalidatePath("/admin/payroll");
    redirect("/admin/payroll?tab=runs");
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

  const headerDescription = details
    ? `${details.name ? `${details.name} · ` : ""}Run #${details.id} · ${details.status} · ${hoursSourceLabel(details.hoursSource)} · pension ${details.pensionEmployeePct ?? 5}% · ${formatUkDateRange(details.periodStart, details.periodEnd)}`
    : `${runs.length} of ${allRuns.length} pay run${allRuns.length === 1 ? "" : "s"} · select a run to view lines and payslips`;

  const guardOptions = users.map((u) => ({
    value: String(u.id),
    label: `${displayGuardName(u.fullName, u.email)} (${u.email})`,
  }));
  const guardFilterLabel = userIdFilter
    ? (() => {
        const u = users.find((x) => x.id === userIdFilter);
        return u ? displayGuardName(u.fullName, u.email) : `Guard #${userIdFilter}`;
      })()
    : null;

  const headerFilters =
    activeTab === "runs" ? (
      <PortalTableToolbarDrawer
        basePath={BASE_PATH}
        title="Pay run filters"
        description="Search pay runs and filter by status."
        summary={statusFilter || undefined}
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
      <PortalTableToolbarDrawer
        basePath={BASE_PATH}
        title="Payroll line filters"
        description="Search lines and filter by guard."
        summary={guardFilterLabel || undefined}
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
      <PortalTableToolbarDrawer
        basePath={BASE_PATH}
        title="Payslip filters"
        description="Search payslips and filter by status or guard."
        summary={[statusFilter || null, guardFilterLabel].filter(Boolean).join(" · ") || undefined}
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
    ) : null;

  const headerActions = (
    <>
      {headerFilters}
      <PortalModal
        triggerLabel="Create Run"
        title="Create payroll run"
        description="Name the run, set the period, hours source, and pension rates."
        triggerClassName="lunar-btn-primary lunar-btn-sm"
      >
        <form action={createRunAction} className="space-y-3">
          <label className="block text-sm text-[var(--portal-text-muted)]">
            Run name
            <input
              name="name"
              required
              maxLength={160}
              placeholder="e.g. July 2026 payroll"
              className="mt-1 lunar-input"
            />
          </label>
          <label className="block text-sm text-[var(--portal-text-muted)]">
            Period start
            <input name="periodStart" type="date" required className="mt-1 lunar-input" />
          </label>
          <label className="block text-sm text-[var(--portal-text-muted)]">
            Period end
            <input name="periodEnd" type="date" required className="mt-1 lunar-input" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm text-[var(--portal-text-muted)]">
              Employee pension %
              <input
                name="pensionEmployeePct"
                type="number"
                min={0}
                max={100}
                step={0.01}
                defaultValue={5}
                required
                className="mt-1 lunar-input"
              />
            </label>
            <label className="block text-sm text-[var(--portal-text-muted)]">
              Employer pension %
              <input
                name="pensionEmployerPct"
                type="number"
                min={0}
                max={100}
                step={0.01}
                defaultValue={3}
                required
                className="mt-1 lunar-input"
              />
            </label>
          </div>
          <fieldset className="space-y-2 rounded-lg border border-[var(--portal-border)] p-3">
            <legend className="px-1 text-sm font-semibold text-[var(--portal-text)]">Hours source</legend>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                name="hoursSource"
                value="attendance"
                defaultChecked
                className="mt-1"
              />
              <span>
                <span className="font-medium text-[var(--portal-text)]">Attendance</span>
                <span className="mt-0.5 block text-xs text-[var(--portal-text-muted)]">
                  Closed check-in / check-out sessions in the period.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="radio" name="hoursSource" value="shifts" className="mt-1" />
              <span>
                <span className="font-medium text-[var(--portal-text)]">Completed shifts</span>
                <span className="mt-0.5 block text-xs text-[var(--portal-text-muted)]">
                  Shifts marked completed whose end time falls in the period.
                </span>
              </span>
            </label>
          </fieldset>
          <button className="lunar-btn-primary w-full">Save payroll run</button>
        </form>
      </PortalModal>
      {details ? (
        <>
          <PortalModal
            triggerLabel="Add Adjustment"
            title="Add adjustment"
            description="Positive pence adds pay; negative pence deducts. Lines recalculate after save."
            triggerClassName="lunar-btn-secondary lunar-btn-sm"
          >
            <form action={addAdjustmentAction} className="space-y-3">
              <input type="hidden" name="runId" value={String(details.id)} />
              <select name="userId" required className="lunar-input">
                <option value="">Select guard</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {displayGuardName(user.fullName, user.email)} ({user.email})
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
          {details.status !== "finalized" ? (
            <form action={reprocessPayrollRunAction}>
              <input type="hidden" name="runId" value={String(details.id)} />
              <button type="submit" className="lunar-btn-secondary lunar-btn-sm">
                Recalculate lines
              </button>
            </form>
          ) : null}
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
          <DeletePayrollRunForm
            runId={details.id}
            action={deletePayrollRunAction}
            label="Delete run"
          />
        </>
      ) : null}
    </>
  );

  return (
    <PortalPage>
      <PortalPageHeader title="Payroll" description={headerDescription} actions={headerActions}>
        <ApiErrorNotice errors={loadErrors} />
        <PortalTabNav basePath={BASE_PATH} tabs={tabs} activeTab={activeTab} preserved={tabPreserved} />
      </PortalPageHeader>

      <PortalPageTableBody>
        {activeTab === "runs" ? (
          <div className="lunar-table-wrap min-h-0 flex-1 overflow-auto rounded-none border-0 bg-transparent">
            <table className="portal-table min-w-[52rem]">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Name</th>
                  <th>Period</th>
                  <th>Hours source</th>
                  <th>Pension</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[var(--portal-text-muted)]">
                      {allRuns.length === 0
                        ? "No payroll runs yet. Use Create Run to start a pay period."
                        : "No pay runs match your filters."}
                    </td>
                  </tr>
                ) : (
                  runs.map((run) => (
                    <tr key={run.id}>
                      <td className="font-medium tabular-nums">#{run.id}</td>
                      <td className="font-medium">{run.name?.trim() || "—"}</td>
                      <td>
                        {formatUkDateRange(run.periodStart, run.periodEnd)}
                      </td>
                      <td>{hoursSourceLabel(run.hoursSource)}</td>
                      <td className="tabular-nums text-sm">
                        {run.pensionEmployeePct ?? 5}% / {run.pensionEmployerPct ?? 3}%
                      </td>
                      <td className="capitalize">{run.status}</td>
                      <td className="text-[var(--portal-text-muted)]">
                        {formatUkDateTime(run.createdAt)}
                      </td>
                      <td className="text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
                          <Link
                            href={`${BASE_PATH}?runId=${run.id}&tab=lines`}
                            className="lunar-btn-secondary lunar-btn-sm"
                          >
                            Open
                          </Link>
                          <DeletePayrollRunForm runId={run.id} action={deletePayrollRunAction} />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : activeTab === "lines" && details ? (
          <div className="lunar-table-wrap min-h-0 flex-1 overflow-auto rounded-none border-0 bg-transparent">
            <table className="portal-table min-w-[64rem]">
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
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-[var(--portal-text-muted)]">
                      {allLines.length === 0
                        ? details.hoursSource === "shifts"
                          ? "No payroll lines for this run. Ensure shifts in this period are marked completed (hours use shift end time)."
                          : "No payroll lines for this run. Ensure guards have closed check-in / check-out sessions in this period."
                        : "No payroll lines match your filters."}
                    </td>
                  </tr>
                ) : null}
                {lines.map((line) => {
                  const name = lineUserLabel(line);
                  const email = lineUserEmail(line);
                  return (
                    <tr key={line.id}>
                      <td>
                        <Link
                          href={`/admin/users/${line.userId}`}
                          className="portal-link font-medium"
                        >
                          {name}
                        </Link>
                        {email ? (
                          <p className="text-xs text-[var(--portal-text-muted)]">
                            <Link href={`/admin/users/${line.userId}`} className="portal-link">
                              {email}
                            </Link>
                          </p>
                        ) : null}
                      </td>
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
                        £
                        {(
                          ((line.metaJson?.payePence ?? 0) + (line.metaJson?.niEmployeePence ?? 0)) /
                          100
                        ).toFixed(2)}
                      </td>
                      <td className="text-xs text-[var(--portal-text-muted)]">
                        £{((line.metaJson?.pensionEmployeePence ?? 0) / 100).toFixed(2)}
                      </td>
                      <td>£{(line.netPence / 100).toFixed(2)}</td>
                      <td className="text-right">
                        <PayrollLineAdjustForm
                          runId={details.id}
                          userId={line.userId}
                          userLabel={name}
                          action={addAdjustmentAction}
                          disabled={details.status === "finalized" || details.status === "processing"}
                        />
                      </td>
                    </tr>
                  );
                })}
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
                  {payslips.map((payslip) => {
                    const u = userById.get(payslip.userId);
                    const name = displayGuardName(u?.fullName, u?.email ?? `User #${payslip.userId}`);
                    return (
                      <tr key={payslip.id}>
                        <td>
                          <Link href={`/admin/users/${payslip.userId}`} className="portal-link font-medium">
                            {name}
                          </Link>
                          {u?.email ? (
                            <p className="text-xs text-[var(--portal-text-muted)]">
                              <Link href={`/admin/users/${payslip.userId}`} className="portal-link">
                                {u.email}
                              </Link>
                            </p>
                          ) : null}
                        </td>
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
                    );
                  })}
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
