import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { DetailTable } from "@/components/portal/detail-table";
import { guardProfileDetailRows } from "@/components/portal/guard-profile-detail-rows";
import { PortalDataTable, type PortalDataTableColumn } from "@/components/portal/portal-data-table";
import { PortalModal } from "@/components/portal/portal-modal";
import { PortalPage, PortalPageHeader, PortalPageTableBody } from "@/components/portal/portal-page-layout";
import { PortalTableToolbar } from "@/components/portal/portal-table-toolbar";
import { StatusBadge } from "@/components/portal/status-badge";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { formatUkDateOnly, formatUkDateTime } from "@/lib/format-datetime";
import {
  currentMonthBounds,
  displayGuardName,
  leavesInMonthForUser,
  type LeaveMonthItem,
} from "@/lib/leave-month-stats";
import { mutateBackend } from "@/lib/portal-mutations";
import {
  compareOptionalDates,
  compareStrings,
  filterByQuery,
  paginateRows,
  parseBulkIds,
  parseSortDir,
  type SortDirection,
} from "@/lib/portal-table";
import { getSessionFromCookies } from "@/lib/server-session";

const BASE_PATH = "/manager/leave";
const PAGE_SIZE = 15;
const SORT_KEYS = ["id", "guard", "leaveType", "startDate", "endDate", "status", "requestedAt"] as const;

type LeaveRequest = LeaveMonthItem & {
  userEmail: string;
  userPhone?: string | null;
  guardName?: string | null;
  guardGivenNames?: string | null;
  guardSurname?: string | null;
  guardGender?: string | null;
  guardDateOfBirth?: string | null;
  guardSiaType?: string | null;
  guardSiaNumber?: string | null;
  guardSiaExpiryDate?: string | null;
  userStatus?: string | null;
  userRole?: string | null;
  reason?: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requestedAt: string;
  managerComment?: string | null;
};

type LeaveRequestsResponse = {
  items: LeaveRequest[];
};

type LeavePageProps = {
  searchParams: Promise<{ q?: string; page?: string; sort?: string; dir?: string; status?: string }>;
};

function sortLeaveRows(rows: LeaveRequest[], sort: string, dir: SortDirection) {
  const copy = [...rows];
  copy.sort((a, b) => {
    switch (sort) {
      case "id":
        return dir === "asc" ? a.id - b.id : b.id - a.id;
      case "guard":
        return compareStrings(
          displayGuardName(a.guardName, a.userEmail),
          displayGuardName(b.guardName, b.userEmail),
          dir,
        );
      case "leaveType":
        return compareStrings(a.leaveType, b.leaveType, dir);
      case "startDate":
        return compareOptionalDates(a.startDate, b.startDate, dir);
      case "endDate":
        return compareOptionalDates(a.endDate, b.endDate, dir);
      case "status":
        return compareStrings(a.status, b.status, dir);
      case "requestedAt":
        return compareStrings(a.requestedAt, b.requestedAt, dir);
      default:
        return compareOptionalDates(a.requestedAt, b.requestedAt, "desc");
    }
  });
  return copy;
}

export default async function ManagerLeavePage({ searchParams }: LeavePageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!["admin", "supervisor"].includes(session.user.role)) redirect("/forbidden");

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const statusFilter = (params.status ?? "").trim();
  const sort = SORT_KEYS.includes(params.sort as (typeof SORT_KEYS)[number])
    ? (params.sort as string)
    : "requestedAt";
  const dir = parseSortDir(params.dir ?? "desc");
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const leaveRes = await backendApiWithSession<LeaveRequestsResponse>("/leave-requests?limit=200", session);
  const allRequests = leaveRes.data?.items ?? [];
  const loadErrors = [apiErrorMessage("Leave requests", leaveRes)];
  const month = currentMonthBounds();

  let filtered = allRequests;
  if (statusFilter) {
    filtered = filtered.filter((r) => r.status === statusFilter);
  }
  filtered = filterByQuery(filtered, q, (r) =>
    [String(r.id), displayGuardName(r.guardName, r.userEmail), r.userEmail, r.leaveType, r.status, r.reason ?? ""].join(
      " ",
    ),
  );

  const sorted = sortLeaveRows(filtered, sort, dir);
  const { slice: pageRows, totalCount, totalPages, currentPage } = paginateRows(sorted, page, PAGE_SIZE);
  const tableQuery = { q: params.q, status: statusFilter, sort, dir };

  async function decisionAction(formData: FormData) {
    "use server";
    const id = Number(formData.get("id"));
    const status = String(formData.get("status") ?? "");
    const managerComment = String(formData.get("managerComment") ?? "").trim();
    if (!id || !status) return;
    await mutateBackend(`/leave-requests/${id}/decision`, "PATCH", {
      status,
      managerComment: managerComment || undefined,
    });
    revalidatePath(BASE_PATH);
  }

  async function bulkLeaveDecisionAction(formData: FormData) {
    "use server";
    const ids = parseBulkIds(formData);
    const status = String(formData.get("bulkStatus") ?? "");
    if (!ids.length || !status) return;
    for (const id of ids) {
      await mutateBackend(`/leave-requests/${id}/decision`, "PATCH", { status });
    }
    revalidatePath(BASE_PATH);
  }

  const columns: PortalDataTableColumn<LeaveRequest>[] = [
    {
      id: "id",
      label: "ID",
      sortable: true,
      cellClassName: "tabular-nums font-medium",
      render: (r) => `#${r.id}`,
    },
    {
      id: "guard",
      label: "Guard",
      sortable: true,
      render: (request) => {
        const guardName = displayGuardName(request.guardName, request.userEmail);
        return (
          <div>
            <p className="font-medium">{guardName}</p>
            <p className="text-xs text-[var(--portal-text-muted)]">{request.userEmail}</p>
          </div>
        );
      },
    },
    {
      id: "leaveType",
      label: "Type",
      sortable: true,
      render: (r) => <span className="capitalize">{r.leaveType}</span>,
    },
    {
      id: "startDate",
      label: "From",
      sortable: true,
      render: (r) => formatUkDateOnly(r.startDate),
    },
    {
      id: "endDate",
      label: "To",
      sortable: true,
      render: (r) => formatUkDateOnly(r.endDate),
    },
    {
      id: "status",
      label: "Status",
      sortable: true,
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      id: "requestedAt",
      label: "Requested",
      sortable: true,
      render: (r) => <span className="text-sm text-[var(--portal-text-muted)]">{formatUkDateTime(r.requestedAt)}</span>,
    },
    {
      id: "actions",
      label: "Actions",
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (request) => {
        const guardName = displayGuardName(request.guardName, request.userEmail);
        const monthLeaves = leavesInMonthForUser(allRequests, request.userId, month.start, month.end);
        return (
          <PortalModal
            triggerLabel="View"
            title={`Leave #${request.id} · ${guardName}`}
            description="Guard profile, this month's leave, and decision"
            triggerClassName="lunar-btn-secondary lunar-btn-sm"
            size="lg"
          >
            <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--portal-text-muted)]">Guard details</h3>
            <DetailTable className="mt-2" rows={guardProfileDetailRows(request)} />

            <h3 className="mt-6 text-xs font-bold uppercase tracking-wide text-[var(--portal-text-muted)]">
              Leaves in {month.label}
            </h3>
            {monthLeaves.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--portal-text-muted)]">No approved or pending leave in this month.</p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--portal-border)]">
                <table className="portal-table min-w-[28rem]">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Type</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthLeaves.map((leave) => (
                      <tr key={leave.id} className={leave.id === request.id ? "bg-lunar-50/60" : undefined}>
                        <td className="tabular-nums font-medium">#{leave.id}</td>
                        <td className="capitalize">{leave.leaveType}</td>
                        <td>{formatUkDateOnly(leave.startDate)}</td>
                        <td>{formatUkDateOnly(leave.endDate)}</td>
                        <td>
                          <StatusBadge status={leave.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 className="mt-6 text-xs font-bold uppercase tracking-wide text-[var(--portal-text-muted)]">
              This request
            </h3>
            <DetailTable
              className="mt-2"
              rows={[
                { label: "Leave type", value: <span className="capitalize">{request.leaveType}</span> },
                { label: "Start date", value: formatUkDateOnly(request.startDate) },
                { label: "End date", value: formatUkDateOnly(request.endDate) },
                { label: "Status", value: <StatusBadge status={request.status} /> },
                { label: "Requested", value: formatUkDateTime(request.requestedAt) },
                { label: "Reason", value: request.reason?.trim() || "—" },
                { label: "Manager comment", value: request.managerComment?.trim() || "—" },
              ]}
            />

            {request.status === "pending" ? (
              <form action={decisionAction} className="mt-5 space-y-3 border-t border-[var(--portal-border)] pt-4">
                <input type="hidden" name="id" value={String(request.id)} />
                <label className="block text-sm text-[var(--portal-text-muted)]">
                  Decision
                  <select name="status" defaultValue="approved" className="mt-1 w-full lunar-select">
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </label>
                <label className="block text-sm text-[var(--portal-text-muted)]">
                  Manager comment
                  <input name="managerComment" placeholder="Optional comment" className="mt-1 w-full lunar-input" />
                </label>
                <button type="submit" className="lunar-btn-primary w-full sm:w-auto">
                  Submit decision
                </button>
              </form>
            ) : null}
          </PortalModal>
        );
      },
    },
  ];

  return (
    <PortalPage>
      <PortalPageHeader
        title="Leave request decisions"
        description={`${totalCount} request${totalCount === 1 ? "" : "s"} · search, filter, sort, and bulk approve`}
      >
        <ApiErrorNotice errors={loadErrors} />
        <PortalTableToolbar
          basePath={BASE_PATH}
          preserved={{ sort, dir }}
          fields={[
            { type: "search", placeholder: "Guard, email, type, ID…", defaultValue: params.q ?? "" },
            {
              type: "select",
              name: "status",
              label: "Status",
              defaultValue: statusFilter,
              options: [
                { value: "", label: "All statuses" },
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
                { value: "cancelled", label: "Cancelled" },
              ],
            },
          ]}
        />
      </PortalPageHeader>

      <PortalPageTableBody>
        <PortalDataTable
          basePath={BASE_PATH}
          query={tableQuery}
          columns={columns}
          rows={pageRows}
          rowKey={(r) => r.id}
          emptyMessage="No leave requests match your filters."
          page={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
          sort={sort}
          dir={dir}
          minWidth="64rem"
          bulk={{
            formId: "leave-bulk-form",
            action: bulkLeaveDecisionAction,
            getRowId: (r) => r.id,
            actions: [
              {
                label: "Approve selected",
                name: "bulkStatus",
                value: "approved",
                variant: "primary",
                confirmMessage: "Approve all selected pending leave requests?",
              },
              {
                label: "Reject selected",
                name: "bulkStatus",
                value: "rejected",
                variant: "danger",
                confirmMessage: "Reject all selected leave requests?",
              },
            ],
          }}
        />
      </PortalPageTableBody>
    </PortalPage>
  );
}
