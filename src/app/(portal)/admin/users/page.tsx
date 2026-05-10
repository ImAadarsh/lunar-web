import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalModal } from "@/components/portal/portal-modal";
import { backendApiWithSession } from "@/lib/backend";
import { mutateBackend } from "@/lib/portal-mutations";
import { getSessionFromCookies } from "@/lib/server-session";

type UsersResponse = {
  items: Array<{
    id: number;
    email: string;
    phone?: string;
    role: "admin" | "supervisor" | "guard";
    status: "active" | "invited" | "suspended";
    created_at?: string;
  }>;
  total: number;
};

type AdminUsersPageProps = {
  searchParams: Promise<{ q?: string; page?: string; error?: string }>;
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/forbidden");

  const usersRes = await backendApiWithSession<UsersResponse>("/users?limit=500", session);
  const allUsers = usersRes.data?.items ?? [];
  const usersLoadError = usersRes.ok ? "" : (usersRes.error?.message ?? "Unable to load users");

  const params = await searchParams;
  const PAGE_SIZE = 15;
  const query = (params.q ?? "").trim().toLowerCase();
  const actionError = (params.error ?? "").trim();
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const filtered = query
    ? allUsers.filter((u) =>
        [u.email, u.phone ?? "", u.role, u.status].join(" ").toLowerCase().includes(query)
      )
    : allUsers;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const users = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
      redirect(`/admin/users?error=${encodeURIComponent(e instanceof Error ? e.message : "Unable to create user")}`);
    }
    revalidatePath("/admin/users");
  }

  async function suspendAction(formData: FormData) {
    "use server";
    const id = Number(formData.get("id"));
    if (!id) return;
    await mutateBackend(`/users/${id}`, "DELETE");
    revalidatePath("/admin/users");
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
      redirect(`/admin/users?error=${encodeURIComponent(e instanceof Error ? e.message : "Unable to update user")}`);
    }
    revalidatePath("/admin/users");
  }

  return (
    <div className="grid gap-4 2xl:grid-cols-[380px_1fr]">
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Create user</h2>
        <p className="text-sm text-slate-500">Adds Admin, Manager (supervisor), or Staff (guard) users.</p>
        {actionError ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {actionError}
          </p>
        ) : null}
        <div className="mt-4">
          <PortalModal
            triggerLabel="Create User"
            title="Create user"
            description="Add a dashboard or guard app user with role and optional phone details."
            triggerClassName="w-full rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lunar-800"
          >
            <form action={createUserAction} className="space-y-3">
              <input
                name="email"
                type="email"
                required
                placeholder="email@example.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
              />
              <input
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="Password (min 8 chars)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
              />
              <select
                name="role"
                defaultValue="guard"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
              >
                <option value="guard">Staff (guard)</option>
                <option value="supervisor">Manager (supervisor)</option>
                <option value="admin">Admin</option>
              </select>
              <input
                name="phone"
                type="text"
                placeholder="Phone (optional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
              />
              <button className="w-full rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lunar-800">
                Save User
              </button>
            </form>
          </PortalModal>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Users</h2>
        {usersLoadError ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {usersLoadError}
          </p>
        ) : null}
        <form className="mt-3">
          <input
            name="q"
            defaultValue={query}
            placeholder="Search email, role, status, phone"
            className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
          />
        </form>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="pb-2">Email</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Phone</th>
                <th className="pb-2">Pay Rate (pence/hr)</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                  <td className="py-2.5">
                    <div>
                      <p>{user.email}</p>
                      <Link href={`/admin/users/${user.id}`} className="text-xs font-semibold text-lunar-700 hover:underline">
                        HR profile
                      </Link>
                    </div>
                  </td>
                  <td className="py-2.5">
                    <select
                      form={`user-update-${user.id}`}
                      name="role"
                      defaultValue={user.role}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      <option value="guard">guard</option>
                      <option value="supervisor">supervisor</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="py-2.5">
                    <select
                      form={`user-update-${user.id}`}
                      name="status"
                      defaultValue={user.status}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      <option value="active">active</option>
                      <option value="invited">invited</option>
                      <option value="suspended">suspended</option>
                    </select>
                  </td>
                  <td className="py-2.5">
                    <input
                      form={`user-update-${user.id}`}
                      name="phone"
                      defaultValue={user.phone ?? ""}
                      className="w-28 rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="py-2.5">
                    <input
                      form={`user-update-${user.id}`}
                      name="payRatePenceHour"
                      type="number"
                      min="0"
                      placeholder="e.g. 1500"
                      className="w-28 rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <form id={`user-update-${user.id}`} action={updateUserAction}>
                        <input type="hidden" name="id" value={String(user.id)} />
                        <button className="rounded-md border border-lunar-200 px-3 py-1 text-xs font-semibold text-lunar-700 hover:bg-lunar-50">
                          Save
                        </button>
                      </form>
                      {user.status !== "suspended" ? (
                        <form action={suspendAction}>
                          <input type="hidden" name="id" value={String(user.id)} />
                          <button className="rounded-md border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                            Suspend
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-slate-400">No action</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-slate-500">
            Showing {users.length} of {filtered.length} users
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/users?page=${Math.max(1, currentPage - 1)}&q=${encodeURIComponent(query)}`}
              className={`rounded-md border px-3 py-1 ${currentPage <= 1 ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            >
              Prev
            </Link>
            <span className="text-slate-600">
              Page {currentPage} / {totalPages}
            </span>
            <Link
              href={`/admin/users?page=${Math.min(totalPages, currentPage + 1)}&q=${encodeURIComponent(query)}`}
              className={`rounded-md border px-3 py-1 ${currentPage >= totalPages ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            >
              Next
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

