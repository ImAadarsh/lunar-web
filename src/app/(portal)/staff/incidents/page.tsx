import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { backendApiWithSession, backendMultipartApiWithSession } from "@/lib/backend";
import { mutateBackend, requirePortalSession } from "@/lib/portal-mutations";
import { getSessionFromCookies } from "@/lib/server-session";

type SiteList = {
  items: Array<{ id: number; name: string }>;
};

type IncidentList = {
  items: Array<{
    id: number;
    siteId: number;
    category: string;
    title: string;
    status: string;
    createdAt: string;
  }>;
};

export default async function StaffIncidentsPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (session.user.role !== "guard") redirect("/forbidden");

  const [sitesRes, incidentsRes] = await Promise.all([
    backendApiWithSession<SiteList>("/sites", session),
    backendApiWithSession<IncidentList>("/incidents", session),
  ]);
  const sites = sitesRes.data?.items ?? [];
  const incidents = incidentsRes.data?.items ?? [];

  async function createIncidentAction(formData: FormData) {
    "use server";
    const siteId = Number(formData.get("siteId"));
    const category = String(formData.get("category") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const evidence = formData.get("evidence");
    if (!siteId || !category || !title) return;
    const created = (await mutateBackend("/incidents", "POST", {
      siteId,
      category,
      title,
      description: description || undefined,
    })) as { id?: number };
    const incidentId = Number(created?.id);
    if (incidentId && evidence instanceof File && evidence.size > 0) {
      const session = await requirePortalSession();
      const uploadData = new FormData();
      uploadData.append("kind", "incident");
      uploadData.append("file", evidence);
      const uploaded = await backendMultipartApiWithSession<{ id: number }>(
        "/media/upload",
        session,
        uploadData,
      );
      if (uploaded.ok && uploaded.data?.id) {
        await mutateBackend(`/incidents/${incidentId}/attachments`, "POST", {
          mediaId: uploaded.data.id,
        });
      }
    }
    revalidatePath("/staff/incidents");
  }

  async function attachEvidenceAction(formData: FormData) {
    "use server";
    const incidentId = Number(formData.get("incidentId"));
    const evidence = formData.get("evidence");
    if (!incidentId || !(evidence instanceof File) || evidence.size <= 0) return;
    const session = await requirePortalSession();
    const uploadData = new FormData();
    uploadData.append("kind", "incident");
    uploadData.append("file", evidence);
    const uploaded = await backendMultipartApiWithSession<{ id: number }>(
      "/media/upload",
      session,
      uploadData,
    );
    if (!uploaded.ok || !uploaded.data?.id) return;
    await mutateBackend(`/incidents/${incidentId}/attachments`, "POST", {
      mediaId: uploaded.data.id,
    });
    revalidatePath("/staff/incidents");
  }

  async function triggerSosAction(formData: FormData) {
    "use server";
    const lat = Number(formData.get("lat"));
    const lng = Number(formData.get("lng"));
    const message = String(formData.get("message") ?? "").trim();
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    await mutateBackend("/sos", "POST", {
      lat,
      lng,
      message: message || undefined,
    });
    revalidatePath("/staff/incidents");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[460px_1fr]">
      <section className="space-y-4">
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Create incident</h2>
          <form action={createIncidentAction} className="mt-3 space-y-3">
            <select
              name="siteId"
              required
              defaultValue=""
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
            >
              <option value="" disabled>
                Select site
              </option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
            <input
              name="category"
              required
              placeholder="Category (theft, fire, maintenance)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
            />
            <input
              name="title"
              required
              placeholder="Incident title"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
            />
            <textarea
              name="description"
              rows={4}
              placeholder="Description"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
            />
            <input
              name="evidence"
              type="file"
              accept="image/*"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-lunar-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-lunar-800"
            />
            <button className="w-full rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lunar-800">
              Submit Incident
            </button>
          </form>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Trigger SOS</h3>
          <p className="text-xs text-slate-500">
            Enter latest coordinates from device for emergency escalation.
          </p>
          <form action={triggerSosAction} className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                name="lat"
                type="number"
                step="any"
                required
                placeholder="Latitude"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
              />
              <input
                name="lng"
                type="number"
                step="any"
                required
                placeholder="Longitude"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
              />
            </div>
            <input
              name="message"
              placeholder="Message (optional)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
            />
            <button className="w-full rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800">
              Trigger SOS
            </button>
          </form>
        </article>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">My incidents</h3>
        <ul className="mt-3 space-y-2">
          {incidents.map((incident) => (
            <li key={incident.id} className="rounded-lg border border-slate-100 p-3">
              <p className="text-sm font-semibold text-slate-900">
                <Link href={`/staff/incidents/${incident.id}`} className="hover:underline">
                  #{incident.id} {incident.title}
                </Link>
              </p>
              <p className="text-xs text-slate-600">
                {incident.category} • Site {incident.siteId}
              </p>
              <p className="mt-1 text-xs text-slate-500">{new Date(incident.createdAt).toLocaleString()}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{incident.status}</p>
              <form action={attachEvidenceAction} className="mt-2 flex items-center gap-2">
                <input type="hidden" name="incidentId" value={String(incident.id)} />
                <input
                  name="evidence"
                  type="file"
                  required
                  accept="image/*"
                  className="max-w-56 rounded-md border border-slate-300 px-2 py-1 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-lunar-100 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-lunar-800"
                />
                <button className="rounded-md border border-lunar-200 px-2.5 py-1 text-xs font-semibold text-lunar-700 hover:bg-lunar-50">
                  Attach Photo
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

