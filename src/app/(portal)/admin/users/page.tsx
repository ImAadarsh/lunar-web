import { revalidatePath } from "next/cache";
import Link from "next/link";
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

const BASE_PATH = "/admin/users";
const PAGE_SIZE = 15;
const SORT_KEYS = ["email", "role", "status", "phone"] as const;

type UserRow = {
  id: number;
  email: string;
  phone?: string;
  role: "admin" | "supervisor" | "guard";
  status: "active" | "invited" | "suspended";
};

type UsersResponse = { items: UserRow[]; total: number };

type AdminUsersPageProps = {
  searchParams: Promise<{ q?: string; page?: string; sort?: string; dir?: string; role?: string; status?: string; error?: string }>;
};

function sortUsers(rows: UserRow[], sort: string, dir: SortDirection) {
  const copy = [...rows];
  copy.sort((a, b) => {
    switch (sort) {
      case "role":
        return compareStrings(a.role, b.role, dir);
      case "status":
        return compareStrings(a.status, b.status, dir);
      case "phone":
        return compareStrings(a.phone ?? "", b.phone ?? "", dir);
      default:
        return compareStrings(a.email, b.email, dir);
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
  const sort = SORT_KEYS.includes(params.sort as (typeof SORT_KEYS)[number]) ? (params.sort as string) : "email";
  const dir = parseSortDir(params.dir);
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const actionError = (params.error ?? "").trim();

  let filtered = allUsers;
  if (roleFilter) filtered = filtered.filter((u) => u.role === roleFilter);
  if (statusFilter) filtered = filtered.filter((u) => u.status === statusFilter);
  filtered = filterByQuery(filtered, q, (u) => [u.email, u.phone ?? "", u.role, u.status].join(" "));

  const sorted = sortUsers(filtered, sort, dir);
  const { slice: users, totalCount, totalPages, currentPage } = paginateRows(sorted, page, PAGE_SIZE);
  const tableQuery = { q: params.q, role: roleFilter, status: statusFilter, sort, dir };

  async function createUserAction(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const role = String(formData.get("role") ?? "guard");
    const phone = String(formData.get("phone") ?? "").trim();
    if (!email || !password) return;
    try {
      await mutateBackend("/users", "POST", {
        email,
        password,
        role,
        phone: phone || undefined,
        status: "active",
      });
    } catch (e) {
      redirect(`${BASE_PATH}?error=${encodeURIComponent(e instanceof Error ? e.message : "Unable to create user")}`);
    }
    revalidatePath(BASE_PATH);
  }

  async function suspendAction(formData: FormData) {
    "use server";
    const id = Number(formData.get("id"));
    if (!id) return;
    await mutateBackend(`/users/${id}`, "DELETE");
    revalidatePath(BASE_PATH);
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

  async function updateUserAction(formData: FormData) {
    "use server";
    const id = Number(formData.get("id"));
    const role = String(formData.get("role") ?? "");
    const status = String(formData.get("status") ?? "");
    const phone = String(formData.get("phone") ?? "").trim();
    const payRatePenceHour = String(formData.get("payRatePenceHour") ?? "").trim();
    if (!id) return;
    try {
      await mutateBackend(`/users/${id}`, "PATCH", {
        role: role || undefined,
        status: status || undefined,
        phone: phone || null,
        payRatePenceHour: payRatePenceHour ? Number(payRatePenceHour) : null,
      });
    } catch (e) {
      redirect(`${BASE_PATH}?error=${encodeURIComponent(e instanceof Error ? e.message : "Unable to update user")}`);
    }
    revalidatePath(BASE_PATH);
  }

  const columns: PortalDataTableColumn<UserRow>[] = [
    {
      id: "email",
      label: "Email",
      sortable: true,
      render: (user) => (
        <div>
          <p className="font-medium">{user.email}</p>
          <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
            <Link href={`/admin/users/${user.id}`} className="text-xs font-semibold text-lunar-700 hover:underline">
              HR profile
            </Link>
            {user.role === "guard" ? (
              <Link href={`/manager/guards/${user.id}`} className="text-xs font-semibold text-lunar-700 hover:underline">
                Ops dashboard
              </Link>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: "role",
      label: "Role",
      sortable: true,
      render: (user) => (
        <select form={`user-update-${user.id}`} name="role" defaultValue={user.role} className="lunar-input-sm">
          <option value="guard">guard</option>
          <option value="supervisor">supervisor</option>
          <option value="admin">admin</option>
        </select>
      ),
    },
    {
      id: "status",
      label: "Status",
      sortable: true,
      render: (user) => (
        <select form={`user-update-${user.id}`} name="status" defaultValue={user.status} className="lunar-input-sm">
          <option value="active">active</option>
          <option value="invited">invited</option>
          <option value="suspended">suspended</option>
        </select>
      ),
    },
    {
      id: "phone",
      label: "Phone",
      sortable: true,
      render: (user) => (
        <input
          form={`user-update-${user.id}`}
          name="phone"
          defaultValue={user.phone ?? ""}
          className="lunar-input-sm w-28"
        />
      ),
    },
    {
      id: "payRate",
      label: "Pay rate",
      render: (user) => (
        <input
          form={`user-update-${user.id}`}
          name="payRatePenceHour"
          type="number"
          min="0"
          placeholder="pence/hr"
          className="lunar-input-sm w-28"
        />
      ),
    },
    {
      id: "actions",
      label: "Actions",
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (user) => (
        <div className="flex items-center justify-end gap-2">
          <form id={`user-update-${user.id}`} action={updateUserAction}>
            <input type="hidden" name="id" value={String(user.id)} />
            <button type="submit" className="lunar-btn-secondary lunar-btn-sm">
              Save
            </button>
          </form>
          {user.status !== "suspended" ? (
            <form action={suspendAction}>
              <input type="hidden" name="id" value={String(user.id)} />
              <button type="submit" className="lunar-btn-danger lunar-btn-sm">
                Suspend
              </button>
            </form>
          ) : (
            <span className="text-xs text-[var(--portal-text-muted)]">Suspended</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <PortalPage>
      <PortalPageHeader
        title="Users"
        description={`${totalCount} user${totalCount === 1 ? "" : "s"} · search, filter, sort, bulk suspend`}
        actions={
          <PortalModal
            triggerLabel="Create user"
            title="Create user"
            description="Add a dashboard or guard app user with role and optional phone details."
            triggerClassName="lunar-btn-primary"
          >
            <form action={createUserAction} className="space-y-3">
              <input name="email" type="email" required placeholder="email@example.com" className="lunar-input" />
              <input
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="Password (min 8 chars)"
                className="lunar-input"
              />
              <select name="role" defaultValue="guard" className="lunar-input">
                <option value="guard">Staff (guard)</option>
                <option value="supervisor">Manager (supervisor)</option>
                <option value="admin">Admin</option>
              </select>
              <input name="phone" type="text" placeholder="Phone (optional)" className="lunar-input" />
              <button type="submit" className="lunar-btn-primary w-full">
                Save User
              </button>
            </form>
          </PortalModal>
        }
      >
        <ApiErrorNotice errors={usersLoadError ? [usersLoadError] : []} />
        {actionError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{actionError}</p>
        ) : null}
        <PortalTableToolbar
          basePath={BASE_PATH}
          preserved={{ sort, dir }}
          fields={[
            { type: "search", placeholder: "Email, phone, role…", defaultValue: params.q ?? "" },
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
          minWidth="56rem"
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
