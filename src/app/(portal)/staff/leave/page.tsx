import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { PortalModal } from "@/components/portal/portal-modal";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { mutateBackend } from "@/lib/portal-mutations";
import { getSessionFromCookies } from "@/lib/server-session";

type LeaveList = {
  items: Array<{
    id: number;
    leaveType: "annual" | "sick" | "unpaid" | "other";
    startDate: string;
    endDate: string;
    reason?: string;
    status: "pending" | "approved" | "rejected" | "cancelled";
    requestedAt: string;
  }>;
};

export default async function StaffLeavePage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (session.user.role !== "guard") redirect("/forbidden");

  const leaveRes = await backendApiWithSession<LeaveList>("/leave-requests?limit=100", session);
  const requests = leaveRes.data?.items ?? [];
  const loadErrors = [apiErrorMessage("Leave requests", leaveRes)];

  async function createLeaveAction(formData: FormData) {
    "use server";
    const leaveType = String(formData.get("leaveType") ?? "annual");
    const startDate = String(formData.get("startDate") ?? "");
    const endDate = String(formData.get("endDate") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();
    if (!startDate || !endDate) return;
    await mutateBackend("/leave-requests", "POST", {
      leaveType,
      startDate,
      endDate,
      reason: reason || undefined,
    });
    revalidatePath("/staff/leave");
  }

  async function cancelLeaveAction(formData: FormData) {
    "use server";
    const id = Number(formData.get("id"));
    if (!id) return;
    await mutateBackend(`/leave-requests/${id}/cancel`, "PATCH");
    revalidatePath("/staff/leave");
  }

  return (
    <div className="grid gap-4 2xl:grid-cols-[420px_1fr]">
      <div className="2xl:col-span-2">
        <ApiErrorNotice errors={loadErrors} />
      </div>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Submit leave request</h2>
        <p className="mt-1 text-sm text-slate-500">Request time off and track approval status.</p>
        <div className="mt-3">
          <PortalModal
            triggerLabel="Submit Request"
            title="Submit leave request"
            description="Choose dates and provide an optional reason for your manager."
            triggerClassName="w-full rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lunar-800"
          >
            <form action={createLeaveAction} className="space-y-3">
              <select
                name="leaveType"
                defaultValue="annual"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
              >
                <option value="annual">Annual</option>
                <option value="sick">Sick</option>
                <option value="unpaid">Unpaid</option>
                <option value="other">Other</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  name="startDate"
                  type="date"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
                />
                <input
                  name="endDate"
                  type="date"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
                />
              </div>
              <textarea
                name="reason"
                rows={4}
                placeholder="Reason (optional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
              />
              <button className="w-full rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lunar-800">
                Send Request
              </button>
            </form>
          </PortalModal>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">My leave requests</h3>
        <ul className="mt-3 space-y-2">
          {requests.map((request) => (
            <li key={request.id} className="rounded-lg border border-slate-100 p-3">
              <p className="text-sm font-semibold text-slate-900">
                #{request.id} • {request.leaveType}
              </p>
              <p className="text-xs text-slate-600">
                {request.startDate} to {request.endDate}
              </p>
              {request.reason ? <p className="mt-1 text-xs text-slate-700">{request.reason}</p> : null}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{request.status}</span>
                {request.status === "pending" ? (
                  <form action={cancelLeaveAction}>
                    <input type="hidden" name="id" value={String(request.id)} />
                    <button className="rounded-md border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                      Cancel
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

