import { AttachmentGallery } from "@/components/incidents/attachment-gallery";

type IncidentAttachment = {
  id: number;
  mediaId: number;
  kind?: string;
  storageKey?: string;
  publicUrl?: string;
  mime?: string;
  sizeBytes?: number;
  createdAt?: string;
};

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
  attachments?: IncidentAttachment[];
};

type IncidentDetailPanelProps = {
  incident: IncidentDetail;
  heading: string;
  canDeleteAttachments?: boolean;
  deleteAttachmentAction?: (formData: FormData) => Promise<void>;
};

export function IncidentDetailPanel({
  incident,
  heading,
  canDeleteAttachments = false,
  deleteAttachmentAction,
}: IncidentDetailPanelProps) {
  const attachments = incident.attachments ?? [];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-lunar-600">{heading}</p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">
          Incident #{incident.id}: {incident.title}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {incident.category} • Site {incident.siteId} • Guard {incident.userId}
        </p>
        <p className="mt-2 text-sm text-slate-700">{incident.description || "No description provided."}</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Attachments</h2>
          {attachments.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No media attachments yet.</p>
          ) : (
            <div className="mt-3">
              <AttachmentGallery
                incidentId={incident.id}
                attachments={attachments}
                canDeleteAttachments={canDeleteAttachments}
                deleteAttachmentAction={deleteAttachmentAction}
              />
            </div>
          )}
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Timeline</h2>
          <ol className="mt-3 space-y-3 text-sm">
            <li className="rounded-lg border border-slate-100 p-3">
              <p className="font-medium text-slate-900">Created</p>
              <p className="text-slate-600">{new Date(incident.createdAt).toLocaleString()}</p>
            </li>
            <li className="rounded-lg border border-slate-100 p-3">
              <p className="font-medium text-slate-900">Current status</p>
              <p className="text-slate-600 capitalize">{incident.status}</p>
              {incident.updatedAt ? (
                <p className="mt-1 text-xs text-slate-500">
                  Updated {new Date(incident.updatedAt).toLocaleString()}
                </p>
              ) : null}
            </li>
            <li className="rounded-lg border border-slate-100 p-3">
              <p className="font-medium text-slate-900">Attachments linked</p>
              <p className="text-slate-600">{attachments.length}</p>
            </li>
          </ol>
        </article>
      </section>
    </div>
  );
}

