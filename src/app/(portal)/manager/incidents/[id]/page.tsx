import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { backendApiWithSession } from "@/lib/backend";
import { mutateBackend } from "@/lib/portal-mutations";
import { IncidentDetailPanel } from "@/components/incidents/incident-detail-panel";
import { getSessionFromCookies } from "@/lib/server-session";

type IncidentDetail = {
  id: number;
  userId: number;
  siteId: number;
  category: string;
  title: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  attachments?: Array<{
    id: number;
    mediaId: number;
    kind?: string;
    storageKey?: string;
    publicUrl?: string;
    mime?: string;
    sizeBytes?: number;
    createdAt?: string;
  }>;
};

type ManagerIncidentDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ManagerIncidentDetailPage({ params }: ManagerIncidentDetailPageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!["admin", "supervisor"].includes(session.user.role)) redirect("/forbidden");

  const p = await params;
  const id = Number(p.id);
  if (!id) redirect("/manager/incidents");

  const detailRes = await backendApiWithSession<IncidentDetail>(`/incidents/${id}`, session);

  async function deleteAttachmentAction(formData: FormData) {
    "use server";
    const incidentId = Number(formData.get("incidentId"));
    const attachmentId = Number(formData.get("attachmentId"));
    if (!incidentId || !attachmentId) return;
    await mutateBackend(`/incidents/${incidentId}/attachments/${attachmentId}`, "DELETE");
    revalidatePath(`/manager/incidents/${incidentId}`);
  }
  if (!detailRes.ok || !detailRes.data) {
    return (
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Incident not available</h2>
        <p className="mt-2 text-sm text-slate-600">
          {detailRes.error?.message || "The incident could not be loaded."}
        </p>
        <Link href="/manager/incidents" className="mt-4 inline-block text-sm font-semibold text-lunar-700 hover:underline">
          Back to incidents
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <Link href="/manager/incidents" className="text-sm font-semibold text-lunar-700 hover:underline">
        ← Back to incidents
      </Link>
      <IncidentDetailPanel
        incident={detailRes.data}
        heading="Manager Incident Detail"
        canDeleteAttachments
        deleteAttachmentAction={deleteAttachmentAction}
      />
    </div>
  );
}

