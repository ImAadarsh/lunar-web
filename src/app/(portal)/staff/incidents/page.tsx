import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PortalDetailLink } from "@/components/portal/portal-detail-link";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import {
  PortalPage,
  PortalPageHeader,
  PortalPageTableBody,
} from "@/components/portal/portal-page-layout";
import { PortalModal } from "@/components/portal/portal-modal";
import { apiErrorMessage, backendApiWithSession, backendMultipartApiWithSession } from "@/lib/backend";
import { formatUkDateTime } from "@/lib/format-datetime";
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
  const loadErrors = [
    apiErrorMessage("Sites", sitesRes),
    apiErrorMessage("Incidents", incidentsRes),
  ];

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

  const headerActions = (
    <>
      <PortalModal
        triggerLabel="Create Incident"
        title="Create incident"
        description="Report a new incident and attach an optional evidence image."
        triggerClassName="lunar-btn-primary lunar-btn-sm"
      >
        <form action={createIncidentAction} className="space-y-3">
          <select name="siteId" required defaultValue="" className="lunar-input">
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
            className="lunar-input"
          />
          <input name="title" required placeholder="Incident title" className="lunar-input" />
          <textarea name="description" rows={4} placeholder="Description" className="lunar-input" />
          <input
            name="evidence"
            type="file"
            accept="image/*"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-lunar-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-lunar-800"
          />
          <button className="lunar-btn-primary w-full">Submit Incident</button>
        </form>
      </PortalModal>
      <PortalModal
        triggerLabel="Trigger SOS"
        title="Trigger SOS"
        description="Send an emergency alert using the latest known coordinates."
        triggerClassName="rounded-lg bg-rose-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-800"
      >
        <form action={triggerSosAction} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input name="lat" type="number" step="any" required placeholder="Latitude" className="lunar-input" />
            <input name="lng" type="number" step="any" required placeholder="Longitude" className="lunar-input" />
          </div>
          <input name="message" placeholder="Message (optional)" className="lunar-input" />
          <button className="w-full rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800">
            Send SOS
          </button>
        </form>
      </PortalModal>
    </>
  );

  return (
    <PortalPage>
      <PortalPageHeader
        title="Incidents & SOS"
        description={`${incidents.length} incident${incidents.length === 1 ? "" : "s"} · report issues or trigger emergency SOS`}
        actions={headerActions}
      >
        <ApiErrorNotice errors={loadErrors} />
      </PortalPageHeader>

      <PortalPageTableBody>
        <div className="lunar-table-wrap min-h-0 flex-1 overflow-auto rounded-none border-0 bg-transparent">
          <table className="portal-table min-w-[48rem]">
            <thead>
              <tr>
                <th>Incident</th>
                <th>Category</th>
                <th>Site</th>
                <th>Status</th>
                <th>Created</th>
                <th className="text-right">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {incidents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[var(--portal-text-muted)]">
                    No incidents yet. Use Create Incident to report an issue.
                  </td>
                </tr>
              ) : (
                incidents.map((incident) => (
                  <tr key={incident.id}>
                    <td className="font-medium">
                      <PortalDetailLink href={`/staff/incidents/${incident.id}`} className="hover:underline">
                        #{incident.id} {incident.title}
                      </PortalDetailLink>
                    </td>
                    <td>{incident.category}</td>
                    <td>{incident.siteId}</td>
                    <td className="text-xs font-semibold uppercase text-[var(--portal-text-muted)]">
                      {incident.status}
                    </td>
                    <td className="text-[var(--portal-text-muted)]">{formatUkDateTime(incident.createdAt)}</td>
                    <td className="text-right">
                      <form action={attachEvidenceAction} className="flex items-center justify-end gap-2">
                        <input type="hidden" name="incidentId" value={String(incident.id)} />
                        <input
                          name="evidence"
                          type="file"
                          required
                          accept="image/*"
                          className="max-w-40 lunar-input-sm file:mr-2 file:rounded-md file:border-0 file:bg-lunar-100 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-lunar-800"
                        />
                        <button className="lunar-btn-secondary lunar-btn-sm">Attach</button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PortalPageTableBody>
    </PortalPage>
  );
}
