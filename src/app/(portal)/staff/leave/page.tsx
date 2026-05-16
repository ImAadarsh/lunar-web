import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { PortalPage, PortalPageBody, PortalPageHeader } from "@/components/portal/portal-page-layout";
import { PortalModal } from "@/components/portal/portal-modal";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { formatUkDateOnly, formatUkDateTime } from "@/lib/format-datetime";
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
    <PortalPage>
      <PortalPageHeader
        title="Leave requests"
        description="Submit time off and track approval status."
        actions={
          <PortalModal
            triggerLabel="Submit request"
            title="Submit leave request"
            description="Choose dates and provide an optional reason for your manager."
            triggerClassName="lunar-btn-primary"
          >
            <form action={createLeaveAction} className="space-y-3">
              <select name="leaveType" defaultValue="annual" className="lunar-input">
                <option value="annual">Annual</option>
                <option value="sick">Sick</option>
                <option value="unpaid">Unpaid</option>
                <option value="other">Other</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input name="startDate" type="date" required className="lunar-input" />
                <input name="endDate" type="date" required className="lunar-input" />
              </div>
              <textarea name="reason" rows={4} placeholder="Reason (optional)" className="lunar-input" />
              <button className="lunar-btn-primary w-full">Send Request</button>
            </form>
          </PortalModal>
        }
      >
        <ApiErrorNotice errors={loadErrors} />
      </PortalPageHeader>
      <PortalPageBody padded>
        <ul className="space-y-2">
          {requests.map((request) => (
            <li key={request.id} className="rounded-lg border border-slate-100 p-3">
              <p className="text-sm font-semibold text-slate-900">
                #{request.id} • {request.leaveType}
              </p>
              <p className="text-xs text-slate-600">
                {formatUkDateOnly(request.startDate)} to {formatUkDateOnly(request.endDate)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Requested {formatUkDateTime(request.requestedAt)}</p>
              {request.reason ? <p className="mt-1 text-xs text-slate-700">{request.reason}</p> : null}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {request.status}
                </span>
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
      </PortalPageBody>
    </PortalPage>
  );
}
