import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { PortalDataTable, type PortalDataTableColumn } from "@/components/portal/portal-data-table";
import { PortalPage, PortalPageHeader, PortalPageTableBody } from "@/components/portal/portal-page-layout";
import { PortalTableToolbarDrawer } from "@/components/portal/portal-table-toolbar-drawer";
import { StatusBadge } from "@/components/portal/status-badge";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { formatUkDateTime } from "@/lib/format-datetime";
import { mutateBackend } from "@/lib/portal-mutations";
import {
  compareOptionalDates,
  compareStrings,
  filterByQuery,
  paginateRows,
  parsePortalPageSize,
  parseSortDir,
  type SortDirection,
} from "@/lib/portal-table";
import { getSessionFromCookies } from "@/lib/server-session";

const BASE_PATH = "/manager/leads";
const SORT_KEYS = ["id", "name", "email", "company", "status", "createdAt"] as const;
const STATUSES = ["new", "contacted", "qualified", "closed"] as const;

type Lead = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  message?: string | null;
  source: string;
  pageUrl?: string | null;
  status: (typeof STATUSES)[number];
  createdAt: string;
};

type LeadsResponse = { items: Lead[] };

type LeadsPageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
    pageSize?: string;
    sort?: string;
    dir?: string;
    status?: string;
  }>;
};

function sortLeadRows(rows: Lead[], sort: string, dir: SortDirection) {
  const copy = [...rows];
  copy.sort((a, b) => {
    switch (sort) {
      case "id":
        return dir === "asc" ? a.id - b.id : b.id - a.id;
      case "name":
        return compareStrings(a.name, b.name, dir);
      case "email":
        return compareStrings(a.email, b.email, dir);
      case "company":
        return compareStrings(a.company ?? "", b.company ?? "", dir);
      case "status":
        return compareStrings(a.status, b.status, dir);
      case "createdAt":
        return compareOptionalDates(a.createdAt, b.createdAt, dir);
      default:
        return compareOptionalDates(a.createdAt, b.createdAt, "desc");
    }
  });
  return copy;
}

export default async function ManagerLeadsPage({ searchParams }: LeadsPageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!["admin", "supervisor"].includes(session.user.role)) redirect("/forbidden");

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const statusFilter = (params.status ?? "").trim();
  const sort = SORT_KEYS.includes(params.sort as (typeof SORT_KEYS)[number])
    ? (params.sort as string)
    : "createdAt";
  const dir = parseSortDir(params.dir ?? "desc");
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = parsePortalPageSize(params.pageSize);

  const leadsRes = await backendApiWithSession<LeadsResponse>("/leads?limit=200", session);
  const loadErrors = [apiErrorMessage("Leads", leadsRes)];
  let rows = leadsRes.data?.items ?? [];
  if (statusFilter) {
    rows = rows.filter((r) => r.status === statusFilter);
  }
  rows = filterByQuery(rows, q, (r) =>
    [r.name, r.email, r.phone ?? "", r.company ?? "", r.message ?? "", r.source, r.status].join(" "),
  );
  rows = sortLeadRows(rows, sort, dir);
  const { slice, totalCount, totalPages, currentPage } = paginateRows(rows, page, pageSize);

  async function updateLeadStatusAction(formData: FormData) {
    "use server";
    const id = Number(formData.get("id"));
    const status = String(formData.get("status") ?? "");
    if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) return;
    await mutateBackend(`/leads/${id}`, "PATCH", { status });
    revalidatePath(BASE_PATH);
  }

  const columns: PortalDataTableColumn<Lead>[] = [
    {
      id: "id",
      label: "ID",
      sortable: true,
      cellClassName: "tabular-nums font-medium",
      render: (r) => `#${r.id}`,
    },
    {
      id: "name",
      label: "Name",
      sortable: true,
      render: (r) => (
        <div className="min-w-[10rem]">
          <div className="font-medium">{r.name}</div>
          {r.phone ? <div className="text-xs text-[var(--lunar-muted)]">{r.phone}</div> : null}
        </div>
      ),
    },
    {
      id: "email",
      label: "Email",
      sortable: true,
      render: (r) => (
        <a className="text-[var(--lunar-accent)] underline-offset-2 hover:underline" href={`mailto:${r.email}`}>
          {r.email}
        </a>
      ),
    },
    {
      id: "company",
      label: "Company",
      sortable: true,
      render: (r) => r.company?.trim() || "—",
    },
    {
      id: "message",
      label: "Message",
      render: (r) => (
        <span className="line-clamp-2 max-w-[18rem] text-sm text-[var(--lunar-muted)]" title={r.message ?? undefined}>
          {r.message?.trim() || "—"}
        </span>
      ),
    },
    {
      id: "source",
      label: "Source",
      render: (r) => <span className="text-sm capitalize">{r.source.replace(/-/g, " ")}</span>,
    },
    {
      id: "status",
      label: "Status",
      sortable: true,
      render: (r) => (
        <div className="flex flex-col gap-2">
          <StatusBadge status={r.status} />
          <form action={updateLeadStatusAction} className="flex items-center gap-1">
            <input type="hidden" name="id" value={r.id} />
            <select
              name="status"
              defaultValue={r.status}
              className="lunar-input h-8 min-w-[7.5rem] px-2 text-xs"
              aria-label={`Update status for lead ${r.id}`}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button type="submit" className="lunar-btn-secondary h-8 px-2 text-xs">
              Save
            </button>
          </form>
        </div>
      ),
    },
    {
      id: "createdAt",
      label: "Received",
      sortable: true,
      render: (r) => formatUkDateTime(r.createdAt),
    },
  ];

  return (
    <PortalPage>
      <PortalPageHeader
        title="Website leads"
        description={`${totalCount} website enquir${totalCount === 1 ? "y" : "ies"} for site admins to follow up`}
        actions={
          <PortalTableToolbarDrawer
            basePath={BASE_PATH}
            title="Lead filters"
            fields={[
              { type: "search", placeholder: "Name, email, company…", defaultValue: params.q ?? "" },
              {
                type: "select",
                name: "status",
                label: "Status",
                defaultValue: statusFilter,
                options: [
                  { value: "", label: "All statuses" },
                  { value: "new", label: "New" },
                  { value: "contacted", label: "Contacted" },
                  { value: "qualified", label: "Qualified" },
                  { value: "closed", label: "Closed" },
                ],
              },
            ]}
          />
        }
      >
        <ApiErrorNotice errors={loadErrors} />
      </PortalPageHeader>
      <PortalPageTableBody>
        <PortalDataTable
          basePath={BASE_PATH}
          query={{ q: params.q, status: statusFilter || undefined, pageSize }}
          columns={columns}
          rows={slice}
          rowKey={(r) => r.id}
          emptyMessage="No website leads yet. New contact-form submissions will appear here."
          page={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          sort={sort}
          dir={dir}
        />
      </PortalPageTableBody>
    </PortalPage>
  );
}
