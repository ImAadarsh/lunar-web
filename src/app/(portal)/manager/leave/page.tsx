import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { backendApiWithSession } from "@/lib/backend";
import { mutateBackend } from "@/lib/portal-mutations";
import { getSessionFromCookies } from "@/lib/server-session";

type LeaveRequestsResponse = {
  items: Array<{
    id: number;
    userId: number;
    userEmail: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    reason?: string;
    status: "pending" | "approved" | "rejected" | "cancelled";
    requestedAt: string;
  }>;
};

export default async function ManagerLeavePage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!["admin", "supervisor"].includes(session.user.role)) redirect("/forbidden");

  const leaveRes = await backendApiWithSession<LeaveRequestsResponse>("/leave-requests?limit=100", session);
  const requests = leaveRes.data?.items ?? [];

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
    revalidatePath("/manager/leave");
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Leave request decisions</h2>
      <p className="text-sm text-slate-500">Approve or reject pending requests from guards.</p>
      <ul className="mt-4 space-y-3">
        {requests.map((request) => (
          <li key={request.id} className="rounded-lg border border-slate-100 p-3">
            <p className="text-sm font-semibold text-slate-900">
              #{request.id} • {request.userEmail}
            </p>
            <p className="text-xs text-slate-600">
              {request.leaveType} • {request.startDate} to {request.endDate}
            </p>
            {request.reason ? <p className="mt-1 text-xs text-slate-700">{request.reason}</p> : null}
            <p className="mt-1 text-xs text-slate-500">Status: {request.status}</p>
            {request.status === "pending" ? (
              <form action={decisionAction} className="mt-2 flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={String(request.id)} />
                <select
                  name="status"
                  defaultValue="approved"
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-lunar-400"
                >
                  <option value="approved">approved</option>
                  <option value="rejected">rejected</option>
                </select>
                <input
                  name="managerComment"
                  placeholder="Comment (optional)"
                  className="min-w-52 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-lunar-400"
                />
                <button className="rounded-md bg-lunar-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-lunar-800">
                  Submit
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

