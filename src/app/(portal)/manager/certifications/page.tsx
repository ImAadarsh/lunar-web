import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { backendApiWithSession } from "@/lib/backend";
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

  const [certsRes, usersRes] = await Promise.all([
    backendApiWithSession<CertificationsResponse>(certPath, session),
    isAdmin
      ? backendApiWithSession<UsersResponse>("/users?limit=200", session)
      : Promise.resolve(null),
  ]);
  const certs = certsRes.data?.items ?? [];
  const users = usersRes?.data?.items ?? [];

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

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
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
          <form action={createCertAction} className="mt-3 space-y-3">
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
              Add Certification
            </button>
          </form>
        ) : null}
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

