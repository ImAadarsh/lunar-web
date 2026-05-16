import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { PortalDataTable, type PortalDataTableColumn } from "@/components/portal/portal-data-table";
import { PortalModal } from "@/components/portal/portal-modal";
import {
  PortalPage,
  PortalPageHeader,
  PortalPageTableBody,
} from "@/components/portal/portal-page-layout";
import { AssignTrainingForm } from "@/components/training/assign-training-form";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { formatUkTrainedOn } from "@/lib/format-datetime";
import { mutateBackend } from "@/lib/portal-mutations";
import { compareOptionalDates, compareStrings, parseBulkIds, type SortDirection } from "@/lib/portal-table";
import { getSessionFromCookies } from "@/lib/server-session";

const BASE_PATH = "/manager/training";
const PAGE_SIZE = 20;
const SORT_KEYS = ["userEmail", "siteName", "trainedOn", "notes", "createdAt"] as const;

type TrainingRow = {
  id: number;
  userId: number;
    userEmail: string;
    guardName?: string | null;
  siteId: number;
  siteName: string;
  trainedOn?: string | null;
  notes?: string | null;
  createdAt?: string;
};

type TrainingAssignmentsResponse = { items: TrainingRow[] };
type UsersResponse = {
  items: Array<{ id: number; email: string; role: string; fullName?: string | null }>;
};
type SitesResponse = {
  items: Array<{ id: number; name: string; isActive: number | boolean }>;
};

type TrainingPageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
    sort?: string;
    dir?: string;
    siteId?: string;
    userId?: string;
  }>;
};

function sortRows(rows: TrainingRow[], sort: string, dir: SortDirection) {
  const copy = [...rows];
  copy.sort((a, b) => {
    switch (sort) {
      case "userEmail":
        return compareStrings(a.guardName ?? a.userEmail, b.guardName ?? b.userEmail, dir);
      case "siteName":
        return compareStrings(a.siteName, b.siteName, dir);
      case "trainedOn":
        return compareOptionalDates(a.trainedOn, b.trainedOn, dir);
      case "notes":
        return compareStrings((a.notes ?? "").trim(), (b.notes ?? "").trim(), dir);
      case "createdAt":
        return compareStrings(a.createdAt ?? "", b.createdAt ?? "", dir);
      default:
        return compareStrings(a.siteName, b.siteName, dir);
    }
  });
  return copy;
}

export default async function ManagerTrainingPage({ searchParams }: TrainingPageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!["admin", "supervisor"].includes(session.user.role)) redirect("/forbidden");

  const isAdmin = session.user.role === "admin";
  const params = await searchParams;

  const siteId = (params.siteId ?? "").trim();
  const userId = (params.userId ?? "").trim();
  const q = (params.q ?? "").trim().toLowerCase();
  const sort = SORT_KEYS.includes(params.sort as (typeof SORT_KEYS)[number])
    ? (params.sort as string)
    : "siteName";
  const dir: SortDirection = params.dir === "desc" ? "desc" : "asc";
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const apiQuery = new URLSearchParams();
  if (siteId) apiQuery.set("siteId", siteId);
  if (userId) apiQuery.set("userId", userId);
  const assignmentPath = apiQuery.toString()
    ? `/training/assignments?${apiQuery}`
    : "/training/assignments";

  const [assignmentsRes, usersRes, sitesRes] = await Promise.all([
    backendApiWithSession<TrainingAssignmentsResponse>(assignmentPath, session),
    isAdmin
      ? backendApiWithSession<UsersResponse>("/users?limit=500", session)
      : Promise.resolve(null),
    backendApiWithSession<SitesResponse>("/sites?limit=200", session),
  ]);

  const allRows = assignmentsRes.data?.items ?? [];
  const guards = (usersRes?.data?.items ?? []).filter((u) => u.role === "guard");
  const sites = sitesRes.data?.items ?? [];

  const guardEmails = new Map<number, string>();
  for (const row of allRows) guardEmails.set(row.userId, row.userEmail);
  const guardOptions = guards.length
    ? guards.map((g) => ({
        id: g.id,
        email: g.fullName ? `${g.fullName} (${g.email})` : g.email,
        role: g.role,
      }))
    : [...guardEmails.entries()].map(([id, email]) => ({ id, email, role: "guard" }));

  let filtered = allRows;
  if (q) {
    filtered = filtered.filter((row) =>
      [row.guardName ?? "", row.userEmail, row.siteName, row.notes ?? "", row.trainedOn ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }

  const sorted = sortRows(filtered, sort, dir);
  const totalCount = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const tableQuery = { q: params.q, siteId, userId };

  const loadErrors = [
    apiErrorMessage("Training assignments", assignmentsRes),
    apiErrorMessage("Users", usersRes),
    apiErrorMessage("Sites", sitesRes),
  ];

  async function assignTrainingAction(formData: FormData) {
    "use server";
    const userIds = formData
      .getAll("userIds")
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0);
    const siteIds = formData
      .getAll("siteIds")
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0);
    const trainedOn = String(formData.get("trainedOn") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    if (!userIds.length || !siteIds.length) return;
    await mutateBackend("/training/assignments/bulk", "POST", {
      userIds,
      siteIds,
      trainedOn: trainedOn || undefined,
      notes: notes || undefined,
    });
    revalidatePath(BASE_PATH);
  }

  async function removeAssignmentAction(formData: FormData) {
    "use server";
    const id = Number(formData.get("id"));
    if (!id) return;
    await mutateBackend(`/training/assignments/${id}`, "DELETE");
    revalidatePath(BASE_PATH);
  }

  async function bulkRemoveAssignmentsAction(formData: FormData) {
    "use server";
    const ids = parseBulkIds(formData);
    if (!ids.length) return;
    for (const id of ids) {
      await mutateBackend(`/training/assignments/${id}`, "DELETE");
    }
    revalidatePath(BASE_PATH);
  }

  const columns: PortalDataTableColumn<TrainingRow>[] = [
    {
      id: "userEmail",
      label: "Guard",
      sortable: true,
      render: (row) => (
        <div>
          <Link href={`/manager/guards/${row.userId}`} className="font-medium text-lunar-800 hover:underline">
            {row.guardName ?? row.userEmail}
          </Link>
          {row.guardName ? <p className="text-xs text-slate-500">{row.userEmail}</p> : null}
        </div>
      ),
    },
    {
      id: "siteName",
      label: "Site",
      sortable: true,
      render: (row) => (
        <Link href={`/manager/sites/${row.siteId}`} className="font-medium text-lunar-800 hover:underline">
          {row.siteName}
        </Link>
      ),
    },
    {
      id: "trainedOn",
      label: "Trained on",
      sortable: true,
      render: (row) => formatUkTrainedOn(row.trainedOn),
    },
    {
      id: "notes",
      label: "Notes",
      sortable: true,
      render: (row) => (
        <span className="line-clamp-2 max-w-xs text-slate-600">{row.notes?.trim() ? row.notes : "—"}</span>
      ),
    },
    ...(isAdmin
      ? [
          {
            id: "actions",
            label: "Actions",
            headerClassName: "text-right",
            cellClassName: "text-right",
            render: (row: TrainingRow) => (
              <form action={removeAssignmentAction}>
                <input type="hidden" name="id" value={String(row.id)} />
                <button type="submit" className="lunar-btn-danger lunar-btn-sm">
                  Remove
                </button>
              </form>
            ),
          } satisfies PortalDataTableColumn<TrainingRow>,
        ]
      : []),
  ];

  return (
    <PortalPage>
      <PortalPageHeader
        title="Training"
        description={`Guard ↔ site assignments · ${totalCount} record${totalCount === 1 ? "" : "s"}`}
        actions={
          isAdmin ? (
              <PortalModal
                triggerLabel="Assign guard to site"
                title="Assign training"
                description="Select one or more guards and sites. Each guard–site pair becomes a training assignment."
                triggerClassName="lunar-btn-primary w-full sm:w-auto"
                panelClassName="max-w-3xl"
              >
                <AssignTrainingForm
                  guards={guardOptions.map((g) => ({ id: g.id, label: g.email }))}
                  sites={sites.map((s) => ({ id: s.id, label: s.name }))}
                  assignAction={assignTrainingAction}
                />
              </PortalModal>
          ) : undefined
        }
      >
        <ApiErrorNotice errors={loadErrors} />

        <form method="get" action={BASE_PATH} className="portal-filter-bar">
            <label className="block min-w-0 text-sm text-slate-600">
              Search
              <input
                name="q"
                type="search"
                defaultValue={params.q ?? ""}
                placeholder="Guard, site, notes…"
                className="mt-1 w-full lunar-input"
              />
            </label>
            <label className="block min-w-0 text-sm text-slate-600">
              Site
              <select name="siteId" defaultValue={siteId} className="mt-1 w-full lunar-select">
                <option value="">All sites</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-0 text-sm text-slate-600">
              Guard
              <select name="userId" defaultValue={userId} className="mt-1 w-full lunar-select">
                <option value="">All guards</option>
                {guardOptions.map((guard) => (
                  <option key={guard.id} value={guard.id}>
                    {guard.email}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <input type="hidden" name="sort" value={sort} />
              <input type="hidden" name="dir" value={dir} />
              <button type="submit" className="lunar-btn-primary">
                Apply
              </button>
              <Link href={BASE_PATH} className="lunar-btn-secondary">
                Reset
              </Link>
            </div>
        </form>
      </PortalPageHeader>

      <PortalPageTableBody>
        <PortalDataTable
          basePath={BASE_PATH}
          query={tableQuery}
          columns={columns}
          rows={pageRows}
          rowKey={(row) => row.id}
          emptyMessage={
            isAdmin
              ? "No training assignments match your filters. Use “Assign guard to site” to add one."
              : "No training assignments match your filters."
          }
          page={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
          sort={sort}
          dir={dir}
          bulk={
            isAdmin
              ? {
                  formId: "training-bulk-remove",
                  action: bulkRemoveAssignmentsAction,
                  getRowId: (row) => row.id,
                  actions: [
                    {
                      label: "Remove selected",
                      name: "bulkAction",
                      value: "remove",
                      variant: "danger",
                      confirmMessage: "Remove selected training assignments?",
                    },
                  ],
                }
              : undefined
          }
        />
      </PortalPageTableBody>
    </PortalPage>
  );
}
