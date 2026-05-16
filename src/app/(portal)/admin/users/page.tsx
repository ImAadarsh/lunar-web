import { revalidatePath } from "next/cache";
import Link from "next/link";
import { PortalDetailLink } from "@/components/portal/portal-detail-link";
import { redirect } from "next/navigation";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { PortalDataTable, type PortalDataTableColumn } from "@/components/portal/portal-data-table";
import { PortalModal } from "@/components/portal/portal-modal";
import { PortalPage, PortalPageHeader, PortalPageTableBody } from "@/components/portal/portal-page-layout";
import { PortalTableToolbar } from "@/components/portal/portal-table-toolbar";
import { backendApiWithSession } from "@/lib/backend";
import { mutateBackend } from "@/lib/portal-mutations";
import {
  compareStrings,
  filterByQuery,
  paginateRows,
  parseBulkIds,
  parseSortDir,
  type SortDirection,
} from "@/lib/portal-table";
import { getSessionFromCookies } from "@/lib/server-session";
import { displayName, roleLabel } from "@/lib/user-display";
import { StatusBadge } from "@/components/portal/status-badge";
import { csvToUserImportRows } from "@/lib/parse-csv";
import { AdminUserCreateForm } from "@/components/admin/admin-user-create-form";
import { AdminUsersBulkImport } from "@/components/admin/admin-users-bulk-import";

const BASE_PATH = "/admin/users";
const PAGE_SIZE = 15;
const SORT_KEYS = ["name", "email", "role", "status", "phone"] as const;

type UserRow = {
  id: number;
  email: string;
  phone?: string | null;
  role: "admin" | "supervisor" | "guard";
  status: "active" | "invited" | "suspended";
  fullName?: string | null;
  siaType?: string | null;
  siaNumber?: string | null;
  siaExpiryDate?: string | null;
  payRatePenceHour?: number | null;
};

type UsersResponse = { items: UserRow[]; total: number };

type AdminUsersPageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
    sort?: string;
    dir?: string;
    role?: string;
    status?: string;
    error?: string;
    importCreated?: string;
    importFailed?: string;
    importErrors?: string;
  }>;
};

function sortUsers(rows: UserRow[], sort: string, dir: SortDirection) {
  const copy = [...rows];
  copy.sort((a, b) => {
    switch (sort) {
      case "email":
        return compareStrings(a.email, b.email, dir);
      case "role":
        return compareStrings(a.role, b.role, dir);
      case "status":
        return compareStrings(a.status, b.status, dir);
      case "phone":
        return compareStrings(a.phone ?? "", b.phone ?? "", dir);
      default:
        return compareStrings(displayName(a.fullName, a.email), displayName(b.fullName, b.email), dir);
    }
  });
  return copy;
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/forbidden");

  const usersRes = await backendApiWithSession<UsersResponse>("/users?limit=500", session);
  const allUsers = usersRes.data?.items ?? [];
  const usersLoadError = usersRes.ok ? "" : (usersRes.error?.message ?? "Unable to load users");

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const roleFilter = (params.role ?? "").trim();
  const statusFilter = (params.status ?? "").trim();
  const sort = SORT_KEYS.includes(params.sort as (typeof SORT_KEYS)[number]) ? (params.sort as string) : "name";
  const dir = parseSortDir(params.dir);
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const actionError = (params.error ?? "").trim();
  const importCreated = Number(params.importCreated ?? "0") || 0;
  const importFailed = Number(params.importFailed ?? "0") || 0;
  const importErrorLines = (params.importErrors ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const bulkImportResult =
    importCreated > 0 || importFailed > 0
      ? { created: importCreated, failed: importFailed, messages: importErrorLines }
      : undefined;

  let filtered = allUsers;
  if (roleFilter) filtered = filtered.filter((u) => u.role === roleFilter);
  if (statusFilter) filtered = filtered.filter((u) => u.status === statusFilter);
  filtered = filterByQuery(filtered, q, (u) =>
    [
      displayName(u.fullName, u.email),
      u.email,
      u.phone ?? "",
      u.role,
      u.status,
      u.siaNumber ?? "",
      u.siaType ?? "",
    ].join(" "),
  );

  const sorted = sortUsers(filtered, sort, dir);
  const { slice: users, totalCount, totalPages, currentPage } = paginateRows(sorted, page, PAGE_SIZE);
  const tableQuery = { q: params.q, role: roleFilter, status: statusFilter, sort, dir };

  async function createUserAction(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const role = String(formData.get("role") ?? "guard") as "admin" | "supervisor" | "guard";
    const status = String(formData.get("status") ?? "active") as "active" | "invited" | "suspended";
    const phone = String(formData.get("phone") ?? "").trim();
    const payRateRaw = String(formData.get("payRatePenceHour") ?? "").trim();
    if (!email || !password) return;

    const profile =
      role === "guard"
        ? {
            fullName: String(formData.get("fullName") ?? "").trim(),
            givenNames: String(formData.get("givenNames") ?? "").trim() || undefined,
            surname: String(formData.get("surname") ?? "").trim() || undefined,
            gender: String(formData.get("gender") ?? "").trim() || undefined,
            dateOfBirth: String(formData.get("dateOfBirth") ?? "").trim() || null,
            siaType: String(formData.get("siaType") ?? "").trim() || undefined,
            siaNumber: String(formData.get("siaNumber") ?? "").trim() || undefined,
            siaExpiryDate: String(formData.get("siaExpiryDate") ?? "").trim() || null,
          }
        : undefined;

    try {
      await mutateBackend("/users", "POST", {
        email,
        password,
        role,
        phone: phone || undefined,
        status,
        payRatePenceHour: payRateRaw ? Number(payRateRaw) : null,
        profile,
      });
    } catch (e) {
      redirect(`${BASE_PATH}?error=${encodeURIComponent(e instanceof Error ? e.message : "Unable to create user")}`);
    }
    revalidatePath(BASE_PATH);
  }

  async function bulkImportUsersAction(formData: FormData) {
    "use server";
    const file = formData.get("csvFile");
    if (!(file instanceof File) || file.size === 0) {
      redirect(`${BASE_PATH}?error=${encodeURIComponent("Choose a CSV file to import.")}`);
    }
    const text = await file.text();
    const users = csvToUserImportRows(text);
    if (!users.length) {
      redirect(
        `${BASE_PATH}?error=${encodeURIComponent("No valid rows found. Use the sample CSV headers and include email, password, and role.")}`,
      );
    }
    if (users.length > 200) {
      redirect(`${BASE_PATH}?error=${encodeURIComponent("Maximum 200 users per import.")}`);
    }
    try {
      const result = (await mutateBackend("/users/import", "POST", { users })) as {
        created?: Array<{ row: number; email: string }>;
        failed?: Array<{ row: number; email: string; message: string }>;
      };
      const created = result.created?.length ?? 0;
      const failed = result.failed?.length ?? 0;
      const messages =
        result.failed?.slice(0, 15).map((f) => `Row ${f.row} (${f.email}): ${f.message}`) ?? [];
      const qs = new URLSearchParams({
        importCreated: String(created),
        importFailed: String(failed),
      });
      if (messages.length) qs.set("importErrors", messages.join("|"));
      redirect(`${BASE_PATH}?${qs.toString()}`);
    } catch (e) {
      redirect(`${BASE_PATH}?error=${encodeURIComponent(e instanceof Error ? e.message : "CSV import failed")}`);
    }
  }

  async function bulkSuspendAction(formData: FormData) {
    "use server";
    const ids = parseBulkIds(formData);
    if (!ids.length) return;
    for (const id of ids) {
      await mutateBackend(`/users/${id}`, "DELETE");
    }
    revalidatePath(BASE_PATH);
  }

  const columns: PortalDataTableColumn<UserRow>[] = [
    {
      id: "name",
      label: "Name",
      sortable: true,
      render: (user) => (
        <div>
          <p className="font-medium text-[var(--portal-text)]">{displayName(user.fullName, user.email)}</p>
          {user.role === "guard" ? (
            <Link
              href={`/manager/guards/${user.id}`}
              className="mt-1 inline-block text-xs font-semibold text-lunar-700 hover:underline"
            >
              Ops dashboard
            </Link>
          ) : null}
        </div>
      ),
    },
    {
      id: "email",
      label: "Email",
      sortable: true,
      render: (user) => <span className="text-sm">{user.email}</span>,
    },
    {
      id: "role",
      label: "Role",
      sortable: true,
      render: (user) => <span className="lunar-badge-neutral">{roleLabel(user.role)}</span>,
    },
    {
      id: "status",
      label: "Status",
      sortable: true,
      render: (user) => <StatusBadge status={user.status} />,
    },
    {
      id: "phone",
      label: "Phone",
      sortable: true,
      render: (user) => <span className="text-sm">{user.phone?.trim() || "—"}</span>,
    },
    {
      id: "actions",
      label: "",
      headerClassName: "text-right w-24",
      cellClassName: "text-right",
      render: (user) => (
        <PortalDetailLink href={`/admin/users/${user.id}`} className="lunar-btn-secondary lunar-btn-sm">
          View
        </PortalDetailLink>
      ),
    },
  ];

  return (
    <PortalPage>
      <PortalPageHeader
        title="Users"
        description={`${totalCount} user${totalCount === 1 ? "" : "s"} · open View to edit, suspend, or manage HR`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PortalModal
              triggerLabel="Bulk import CSV"
              title="Bulk import users"
              description="Import up to 200 users from CSV. Download the sample file for column names."
              triggerClassName="lunar-btn-secondary"
              size="lg"
            >
              <AdminUsersBulkImport action={bulkImportUsersAction} lastResult={bulkImportResult} />
            </PortalModal>
            <PortalModal
              triggerLabel="Create user"
              title="Create user"
              description="Add a portal or guard app account with role, contact details, and guard profile fields when applicable."
              triggerClassName="lunar-btn-primary"
              size="xl"
            >
              <AdminUserCreateForm action={createUserAction} />
            </PortalModal>
          </div>
        }
      >
        <ApiErrorNotice errors={usersLoadError ? [usersLoadError] : []} />
        {actionError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{actionError}</p>
        ) : null}
        {bulkImportResult && !actionError ? (
          <div
            className={`rounded-lg border px-3 py-2 text-sm ${
              bulkImportResult.failed > 0
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
          >
            <p>
              CSV import: <strong>{bulkImportResult.created}</strong> created
              {bulkImportResult.failed > 0 ? (
                <>
                  , <strong>{bulkImportResult.failed}</strong> failed
                </>
              ) : null}
              .
            </p>
            {bulkImportResult.messages?.length ? (
              <ul className="mt-2 max-h-28 list-inside list-disc overflow-y-auto text-xs">
                {bulkImportResult.messages.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <PortalTableToolbar
          basePath={BASE_PATH}
          preserved={{ sort, dir }}
          fields={[
            { type: "search", placeholder: "Name, email, phone…", defaultValue: params.q ?? "" },
            {
              type: "select",
              name: "role",
              label: "Role",
              defaultValue: roleFilter,
              options: [
                { value: "", label: "All roles" },
                { value: "guard", label: "Guard" },
                { value: "supervisor", label: "Supervisor" },
                { value: "admin", label: "Admin" },
              ],
            },
            {
              type: "select",
              name: "status",
              label: "Status",
              defaultValue: statusFilter,
              options: [
                { value: "", label: "All statuses" },
                { value: "active", label: "Active" },
                { value: "invited", label: "Invited" },
                { value: "suspended", label: "Suspended" },
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
          rows={users}
          rowKey={(u) => u.id}
          emptyMessage="No users match your filters."
          page={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
          sort={sort}
          dir={dir}
          minWidth="52rem"
          bulk={{
            formId: "users-bulk-suspend",
            action: bulkSuspendAction,
            getRowId: (u) => u.id,
            actions: [
              {
                label: "Suspend selected",
                name: "bulkAction",
                value: "suspend",
                variant: "danger",
                confirmMessage: "Suspend all selected users?",
              },
            ],
          }}
        />
      </PortalPageTableBody>
    </PortalPage>
  );
}
