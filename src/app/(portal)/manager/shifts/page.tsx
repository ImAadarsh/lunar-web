import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { PortalModal } from "@/components/portal/portal-modal";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { mutateBackend } from "@/lib/portal-mutations";
import { getSessionFromCookies } from "@/lib/server-session";

type ShiftsResponse = {
  items: Array<{
    id: number;
    siteId: number;
    userId: number;
    startsAt: string;
    endsAt: string;
    status: string;
  }>;
};

type SitesResponse = { items: Array<{ id: number; name: string }> };
type UsersResponse = { items: Array<{ id: number; email: string; role: string }> };
type ShiftSwapsResponse = {
  items: Array<{
    id: number;
    shiftId: number;
    requesterEmail: string;
    targetEmail?: string | null;
    status: string;
    siteId: number;
    startsAt: string;
    endsAt: string;
    createdAt: string;
  }>;
};
type AvailabilityResponse = {
  items: Array<{
    id: number;
    userId: number;
    email: string;
    startsAt: string;
    endsAt: string;
    status: string;
    reason?: string | null;
  }>;
};
type ManagerShiftsPageProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

function toLocalInputValue(value: string) {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function ManagerShiftsPage({ searchParams }: ManagerShiftsPageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!["admin", "supervisor"].includes(session.user.role)) redirect("/forbidden");

  const [shiftsRes, sitesRes, usersRes, swapsRes, availabilityRes] = await Promise.all([
    backendApiWithSession<ShiftsResponse>("/shifts", session),
    backendApiWithSession<SitesResponse>("/sites", session),
    backendApiWithSession<UsersResponse>("/users?role=guard&limit=200", session),
    backendApiWithSession<ShiftSwapsResponse>("/shift-swaps?status=pending", session),
    backendApiWithSession<AvailabilityResponse>("/availability", session),
  ]);

  const shifts = shiftsRes.data?.items ?? [];
  const sites = sitesRes.data?.items ?? [];
  const users = usersRes.data?.items ?? [];
  const swaps = swapsRes.data?.items ?? [];
  const availability = availabilityRes.data?.items ?? [];
  const loadErrors = [
    apiErrorMessage("Shifts", shiftsRes),
    apiErrorMessage("Sites", sitesRes),
    apiErrorMessage("Guard users", usersRes),
    apiErrorMessage("Shift swaps", swapsRes),
    apiErrorMessage("Availability", availabilityRes),
  ];
  const params = await searchParams;
  const query = (params.q ?? "").trim().toLowerCase();
  const PAGE_SIZE = 12;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const filtered = query
    ? shifts.filter((s) =>
        [s.id, s.siteId, s.userId, s.status].join(" ").toLowerCase().includes(query)
      )
    : shifts;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedShifts = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function createShiftAction(formData: FormData) {
    "use server";
    const siteId = Number(formData.get("siteId"));
    const userId = Number(formData.get("userId"));
    const startsAt = String(formData.get("startsAt") ?? "");
    const endsAt = String(formData.get("endsAt") ?? "");
    if (!siteId || !userId || !startsAt || !endsAt) return;
    await mutateBackend("/shifts", "POST", {
      siteId,
      userId,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      status: "scheduled",
    });
    revalidatePath("/manager/shifts");
  }

  async function updateShiftAction(formData: FormData) {
    "use server";
    const id = Number(formData.get("id"));
    const siteId = Number(formData.get("siteId"));
    const userId = Number(formData.get("userId"));
    const startsAt = String(formData.get("startsAt") ?? "");
    const endsAt = String(formData.get("endsAt") ?? "");
    const status = String(formData.get("status") ?? "").trim();
    if (!id || !status || !siteId || !userId || !startsAt || !endsAt) return;
    await mutateBackend(`/shifts/${id}`, "PATCH", {
      siteId,
      userId,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      status,
    });
    revalidatePath("/manager/shifts");
  }

  async function updateSwapAction(formData: FormData) {
    "use server";
    const id = Number(formData.get("id"));
    const status = String(formData.get("status") ?? "");
    if (!id || !["approved", "rejected"].includes(status)) return;
    await mutateBackend(`/shift-swaps/${id}`, "PATCH", { status });
    revalidatePath("/manager/shifts");
  }

  async function createAvailabilityAction(formData: FormData) {
    "use server";
    const userId = Number(formData.get("userId"));
    const startsAt = String(formData.get("startsAt") ?? "");
    const endsAt = String(formData.get("endsAt") ?? "");
    const status = String(formData.get("status") ?? "unavailable");
    const reason = String(formData.get("reason") ?? "").trim();
    if (!userId || !startsAt || !endsAt) return;
    await mutateBackend("/availability", "POST", {
      userId,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      status,
      reason: reason || undefined,
    });
    revalidatePath("/manager/shifts");
  }

  function shiftHasAvailabilityConflict(shift: ShiftsResponse["items"][number]) {
    return availability.some((a) => {
      if (a.userId !== shift.userId || a.status !== "unavailable") return false;
      return new Date(a.startsAt) < new Date(shift.endsAt) && new Date(a.endsAt) > new Date(shift.startsAt);
    });
  }

  return (
    <div className="grid gap-4 2xl:grid-cols-[460px_1fr]">
      <div className="2xl:col-span-2">
        <ApiErrorNotice errors={loadErrors} />
      </div>
      <section className="rounded-2xl bg-white p-5 shadow-sm 2xl:col-span-2">
        <h2 className="text-lg font-semibold text-slate-900">Pending shift swaps</h2>
        <p className="text-sm text-slate-500">Approving a targeted swap reassigns the shift after backend conflict checks.</p>
        {swaps.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No pending swap requests.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="pb-2">Swap</th>
                  <th className="pb-2">Shift</th>
                  <th className="pb-2">Requester</th>
                  <th className="pb-2">Target</th>
                  <th className="pb-2">When</th>
                  <th className="pb-2 text-right">Decision</th>
                </tr>
              </thead>
              <tbody>
                {swaps.map((swap) => (
                  <tr key={swap.id} className="border-t border-slate-100">
                    <td className="py-2.5">#{swap.id}</td>
                    <td className="py-2.5">#{swap.shiftId} · site {swap.siteId}</td>
                    <td className="py-2.5">{swap.requesterEmail}</td>
                    <td className="py-2.5">{swap.targetEmail ?? "Open target"}</td>
                    <td className="py-2.5">{new Date(swap.startsAt).toLocaleString()}</td>
                    <td className="py-2.5">
                      <div className="flex justify-end gap-2">
                        <form action={updateSwapAction}>
                          <input type="hidden" name="id" value={String(swap.id)} />
                          <input type="hidden" name="status" value="approved" />
                          <button className="rounded-md bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800">
                            Approve
                          </button>
                        </form>
                        <form action={updateSwapAction}>
                          <input type="hidden" name="id" value={String(swap.id)} />
                          <input type="hidden" name="status" value="rejected" />
                          <button className="rounded-md border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                            Reject
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="rounded-2xl bg-white p-5 shadow-sm 2xl:col-span-2">
        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Availability calendar</h2>
            <p className="text-sm text-slate-500">Add unavailable or preferred windows. Conflicting shifts are highlighted in the schedule.</p>
            <div className="mt-3">
              <PortalModal
                triggerLabel="Add Availability"
                title="Add availability window"
                description="Record unavailable, preferred, or available windows for a guard."
                triggerClassName="w-full rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lunar-800"
              >
                <form action={createAvailabilityAction} className="grid gap-2">
                  <select name="userId" required defaultValue="" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="" disabled>Select guard</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>{user.email}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input name="startsAt" type="datetime-local" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    <input name="endsAt" type="datetime-local" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <select name="status" defaultValue="unavailable" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="unavailable">Unavailable</option>
                    <option value="preferred">Preferred</option>
                    <option value="available">Available</option>
                  </select>
                  <input name="reason" placeholder="Reason" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <button className="rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lunar-800">
                    Save Availability
                  </button>
                </form>
              </PortalModal>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr><th className="pb-2">Guard</th><th className="pb-2">Window</th><th className="pb-2">Status</th><th className="pb-2">Reason</th></tr>
              </thead>
              <tbody>
                {availability.slice(0, 12).map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="py-2.5">{item.email}</td>
                    <td className="py-2.5">{new Date(item.startsAt).toLocaleString()} - {new Date(item.endsAt).toLocaleString()}</td>
                    <td className="py-2.5">{item.status}</td>
                    <td className="py-2.5">{item.reason ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Assign shift</h2>
        <p className="text-sm text-slate-500">Creates a scheduled shift and triggers guard notifications.</p>
        <div className="mt-3">
          <PortalModal
            triggerLabel="Assign Shift"
            title="Assign shift"
            description="Schedule a guard at a site and notify them through the backend."
            triggerClassName="w-full rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lunar-800"
          >
            <form action={createShiftAction} className="space-y-3">
              <select
                name="siteId"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
                defaultValue=""
              >
                <option value="" disabled>
                  Select site
                </option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name} (#{site.id})
                  </option>
                ))}
              </select>
              <select
                name="userId"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
                defaultValue=""
              >
                <option value="" disabled>
                  Select guard
                </option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  name="startsAt"
                  type="datetime-local"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
                />
                <input
                  name="endsAt"
                  type="datetime-local"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
                />
              </div>
              <button className="w-full rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lunar-800">
                Save Shift
              </button>
            </form>
          </PortalModal>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Shifts</h2>
        <form className="mt-3">
          <input
            name="q"
            defaultValue={query}
            placeholder="Search by shift/site/user/status"
            className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
          />
        </form>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="pb-2">ID</th>
                <th className="pb-2">Site</th>
                <th className="pb-2">Guard</th>
                <th className="pb-2">Start</th>
                <th className="pb-2">End</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedShifts.map((shift) => (
                <tr key={shift.id} className={`border-t border-slate-100 align-top hover:bg-slate-50/70 ${shiftHasAvailabilityConflict(shift) ? "bg-amber-50" : ""}`}>
                  <td className="py-2.5">#{shift.id}</td>
                  <td className="py-2.5">
                    <select
                      form={`shift-update-${shift.id}`}
                      name="siteId"
                      defaultValue={String(shift.siteId)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      {sites.map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5">
                    <select
                      form={`shift-update-${shift.id}`}
                      name="userId"
                      defaultValue={String(shift.userId)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.email}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5">
                    <input
                      form={`shift-update-${shift.id}`}
                      name="startsAt"
                      type="datetime-local"
                      defaultValue={toLocalInputValue(shift.startsAt)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="py-2.5">
                    <input
                      form={`shift-update-${shift.id}`}
                      name="endsAt"
                      type="datetime-local"
                      defaultValue={toLocalInputValue(shift.endsAt)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="py-2.5">
                    <select
                      form={`shift-update-${shift.id}`}
                      name="status"
                      defaultValue={shift.status}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs capitalize"
                    >
                      <option value="scheduled">scheduled</option>
                      <option value="active">active</option>
                      <option value="completed">completed</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </td>
                  <td className="py-2.5 text-right">
                    <form id={`shift-update-${shift.id}`} action={updateShiftAction}>
                      <input type="hidden" name="id" value={String(shift.id)} />
                      <button className="rounded-md border border-lunar-200 px-3 py-1 text-xs font-semibold text-lunar-700 hover:bg-lunar-50">
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-slate-500">
            Showing {pagedShifts.length} of {filtered.length} shifts
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={`/manager/shifts?page=${Math.max(1, currentPage - 1)}&q=${encodeURIComponent(query)}`}
              className={`rounded-md border px-3 py-1 ${currentPage <= 1 ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            >
              Prev
            </Link>
            <span className="text-slate-600">
              Page {currentPage} / {totalPages}
            </span>
            <Link
              href={`/manager/shifts?page=${Math.min(totalPages, currentPage + 1)}&q=${encodeURIComponent(query)}`}
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

