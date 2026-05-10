import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { PortalModal } from "@/components/portal/portal-modal";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { mutateBackend } from "@/lib/portal-mutations";
import { getSessionFromCookies } from "@/lib/server-session";

type CertificationsResponse = {
  items: Array<{
    id: number;
    userId: number;
    name: string;
    issuer?: string;
    obtainedOn?: string;
    expiresOn?: string;
  }>;
};

type UsersResponse = { items: Array<{ id: number; email: string; role: string }> };
type TrainingRequirementsResponse = {
  items: Array<{ id: number; name: string; roleSlug: string; renewalMonths?: number | null; isActive: boolean }>;
};
type TrainingComplianceResponse = {
  items: Array<{ userId: number; email: string; requirementId: number; name: string; status: string; expiresOn?: string | null }>;
};
type CertificationsPageProps = {
  searchParams: Promise<{ expiringBefore?: string }>;
};

function certStatus(expiresOn?: string) {
  if (!expiresOn) return { label: "No expiry", className: "bg-slate-100 text-slate-600" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${expiresOn}T00:00:00`);
  const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: "Expired", className: "bg-rose-50 text-rose-700" };
  if (days <= 30) return { label: `${days}d left`, className: "bg-amber-50 text-amber-700" };
  return { label: "Current", className: "bg-emerald-50 text-emerald-700" };
}

export default async function ManagerCertificationsPage({ searchParams }: CertificationsPageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!["admin", "supervisor"].includes(session.user.role)) redirect("/forbidden");

  const isAdmin = session.user.role === "admin";
  const params = await searchParams;
  const expiringBefore = (params.expiringBefore ?? "").trim();
  const certPath = expiringBefore
    ? `/certifications?expiringBefore=${encodeURIComponent(expiringBefore)}`
    : "/certifications";

  const [certsRes, usersRes, trainingReqRes, complianceRes] = await Promise.all([
    backendApiWithSession<CertificationsResponse>(certPath, session),
    isAdmin
      ? backendApiWithSession<UsersResponse>("/users?limit=200", session)
      : Promise.resolve(null),
    backendApiWithSession<TrainingRequirementsResponse>("/training/requirements", session),
    backendApiWithSession<TrainingComplianceResponse>("/training/compliance", session),
  ]);
  const certs = certsRes.data?.items ?? [];
  const users = usersRes?.data?.items ?? [];
  const trainingRequirements = trainingReqRes.data?.items ?? [];
  const compliance = complianceRes.data?.items ?? [];
  const loadErrors = [
    apiErrorMessage("Certifications", certsRes),
    apiErrorMessage("Users", usersRes),
    apiErrorMessage("Training requirements", trainingReqRes),
    apiErrorMessage("Training compliance", complianceRes),
  ];

  async function createCertAction(formData: FormData) {
    "use server";
    const userId = Number(formData.get("userId"));
    const name = String(formData.get("name") ?? "").trim();
    const issuer = String(formData.get("issuer") ?? "").trim();
    const obtainedOn = String(formData.get("obtainedOn") ?? "");
    const expiresOn = String(formData.get("expiresOn") ?? "");
    if (!userId || !name) return;
    await mutateBackend("/certifications", "POST", {
      userId,
      name,
      issuer: issuer || undefined,
      obtainedOn: obtainedOn || undefined,
      expiresOn: expiresOn || undefined,
    });
    revalidatePath("/manager/certifications");
  }

  async function deleteCertAction(formData: FormData) {
    "use server";
    const id = Number(formData.get("id"));
    if (!id) return;
    await mutateBackend(`/certifications/${id}`, "DELETE");
    revalidatePath("/manager/certifications");
  }

  async function createTrainingRequirementAction(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    const renewalMonths = Number(formData.get("renewalMonths"));
    if (!name) return;
    await mutateBackend("/training/requirements", "POST", {
      name,
      roleSlug: "guard",
      renewalMonths: Number.isFinite(renewalMonths) && renewalMonths > 0 ? renewalMonths : undefined,
    });
    revalidatePath("/manager/certifications");
  }

  async function completeTrainingAction(formData: FormData) {
    "use server";
    const requirementId = Number(formData.get("requirementId"));
    const userId = Number(formData.get("userId"));
    const completedOn = String(formData.get("completedOn") ?? "");
    const expiresOn = String(formData.get("expiresOn") ?? "");
    if (!requirementId || !userId || !completedOn) return;
    await mutateBackend(`/training/requirements/${requirementId}/completions`, "POST", {
      userId,
      completedOn,
      expiresOn: expiresOn || undefined,
    });
    revalidatePath("/manager/certifications");
  }

  return (
    <div className="grid gap-4 2xl:grid-cols-[420px_1fr]">
      <div className="2xl:col-span-2">
        <ApiErrorNotice errors={loadErrors} />
      </div>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Certifications</h2>
        <p className="text-sm text-slate-500">
          {isAdmin ? "Create and manage certifications." : "View certification compliance records."}
        </p>
        <form className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-sm text-slate-600">
            Expiring before
            <input
              name="expiringBefore"
              type="date"
              defaultValue={expiringBefore}
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
            />
          </label>
          <button className="rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lunar-800">
            Filter
          </button>
          <a href="/manager/certifications" className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            Clear
          </a>
        </form>
        {isAdmin ? (
          <div className="mt-3">
            <PortalModal
              triggerLabel="Add Certification"
              title="Add certification"
              description="Record a certification, issuer, and expiry for a staff member."
              triggerClassName="w-full rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lunar-800"
            >
              <form action={createCertAction} className="space-y-3">
                <select
                  name="userId"
                  required
                  defaultValue=""
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
                >
                  <option value="" disabled>
                    Select user
                  </option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email}
                    </option>
                  ))}
                </select>
                <input
                  name="name"
                  required
                  placeholder="Certification name"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
                />
                <input
                  name="issuer"
                  placeholder="Issuer"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    name="obtainedOn"
                    type="date"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
                  />
                  <input
                    name="expiresOn"
                    type="date"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
                  />
                </div>
                <button className="w-full rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lunar-800">
                  Save Certification
                </button>
              </form>
            </PortalModal>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm 2xl:col-span-2">
        <div className="grid gap-4 2xl:grid-cols-[360px_1fr]">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Training compliance</h2>
            <p className="text-sm text-slate-500">Required training, completion evidence, renewal alerts, and compliance matrix.</p>
            {isAdmin ? (
              <div className="mt-3">
                <PortalModal
                  triggerLabel="Add Requirement"
                  title="Add training requirement"
                  description="Create a recurring compliance requirement for guards."
                  triggerClassName="w-full rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lunar-800"
                >
                  <form action={createTrainingRequirementAction} className="grid gap-2">
                    <input name="name" required placeholder="Requirement name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    <input name="renewalMonths" type="number" min="1" placeholder="Renewal months" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    <button className="rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lunar-800">
                      Save Requirement
                    </button>
                  </form>
                </PortalModal>
              </div>
            ) : null}
            {isAdmin ? (
              <div className="mt-4">
                <PortalModal
                  triggerLabel="Record Completion"
                  title="Record training completion"
                  description="Mark a user as completed for a requirement and set expiry if needed."
                  triggerClassName="w-full rounded-lg border border-lunar-200 px-4 py-2 text-sm font-semibold text-lunar-700 hover:bg-lunar-50"
                >
                  <form action={completeTrainingAction} className="grid gap-2">
                    <select name="requirementId" required defaultValue="" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      <option value="" disabled>Select requirement</option>
                      {trainingRequirements.map((req) => <option key={req.id} value={req.id}>{req.name}</option>)}
                    </select>
                    <select name="userId" required defaultValue="" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      <option value="" disabled>Select user</option>
                      {users.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <input name="completedOn" type="date" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                      <input name="expiresOn" type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    </div>
                    <button className="rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lunar-800">
                      Save Completion
                    </button>
                  </form>
                </PortalModal>
              </div>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr><th className="pb-2">User</th><th className="pb-2">Requirement</th><th className="pb-2">Expiry</th><th className="pb-2">Status</th></tr>
              </thead>
              <tbody>
                {compliance.map((item) => (
                  <tr key={`${item.userId}-${item.requirementId}`} className="border-t border-slate-100">
                    <td className="py-2.5">{item.email}</td>
                    <td className="py-2.5">{item.name}</td>
                    <td className="py-2.5">{item.expiresOn ?? "-"}</td>
                    <td className="py-2.5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        item.status === "compliant" ? "bg-emerald-50 text-emerald-700" : item.status === "expiring" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Certification records</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-2">User</th>
                <th className="pb-2">Name</th>
                <th className="pb-2">Issuer</th>
                <th className="pb-2">Expires</th>
                <th className="pb-2">Status</th>
                {isAdmin ? <th className="pb-2 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {certs.map((cert) => {
                const status = certStatus(cert.expiresOn);
                return (
                  <tr key={cert.id} className="border-t border-slate-100">
                    <td className="py-2.5">{cert.userId}</td>
                    <td className="py-2.5">{cert.name}</td>
                    <td className="py-2.5">{cert.issuer ?? "-"}</td>
                    <td className="py-2.5">{cert.expiresOn ?? "-"}</td>
                    <td className="py-2.5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    {isAdmin ? (
                      <td className="py-2.5 text-right">
                        <form action={deleteCertAction}>
                          <input type="hidden" name="id" value={String(cert.id)} />
                          <button className="rounded-md border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                            Delete
                          </button>
                        </form>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

