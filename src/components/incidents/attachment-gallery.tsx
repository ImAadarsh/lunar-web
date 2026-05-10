"use client";

import { useMemo, useState } from "react";

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

type AttachmentGalleryProps = {
  incidentId: number;
  attachments: IncidentAttachment[];
  canDeleteAttachments?: boolean;
  deleteAttachmentAction?: (formData: FormData) => Promise<void>;
};

export function AttachmentGallery({
  incidentId,
  attachments,
  canDeleteAttachments = false,
  deleteAttachmentAction,
}: AttachmentGalleryProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const selected = selectedIdx === null ? null : attachments[selectedIdx];
  const hasMultiple = attachments.length > 1;

  const metadata = useMemo(() => {
    if (!selected) return null;
    return [
      `Attachment ID: ${selected.id}`,
      `Media ID: ${selected.mediaId}`,
      `Kind: ${selected.kind || "unknown"}`,
      `MIME: ${selected.mime || "unknown"}`,
      `Storage key: ${selected.storageKey || "n/a"}`,
      `Size: ${selected.sizeBytes ? `${selected.sizeBytes} bytes` : "n/a"}`,
      `Created: ${selected.createdAt ? new Date(selected.createdAt).toLocaleString() : "n/a"}`,
    ];
  }, [selected]);

  function goPrev() {
    if (selectedIdx === null) return;
    setSelectedIdx((selectedIdx - 1 + attachments.length) % attachments.length);
  }

  function goNext() {
    if (selectedIdx === null) return;
    setSelectedIdx((selectedIdx + 1) % attachments.length);
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {attachments.map((asset, idx) => (
          <figure key={asset.id} className="rounded-lg border border-slate-100 p-2">
            <button
              type="button"
              onClick={() => setSelectedIdx(idx)}
              className="block w-full overflow-hidden rounded-md focus:outline-none focus:ring-2 focus:ring-lunar-400"
              title="Open preview"
            >
              {asset.publicUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={asset.publicUrl}
                  alt={`Incident attachment ${asset.id}`}
                  className="h-44 w-full rounded-md object-cover transition hover:scale-[1.02]"
                />
              ) : (
                <div className="flex h-44 items-center justify-center rounded-md bg-slate-100 text-xs text-slate-500">
                  File URL unavailable
                </div>
              )}
            </button>
            <figcaption className="mt-2 text-xs text-slate-600">
              #{asset.id} • {asset.kind || "media"} • {asset.mime || "unknown"}
            </figcaption>
            {canDeleteAttachments && deleteAttachmentAction ? (
              <form
                action={deleteAttachmentAction}
                onSubmit={(event) => {
                  if (!window.confirm("Delete this attachment permanently?")) {
                    event.preventDefault();
                  }
                }}
                className="mt-2"
              >
                <input type="hidden" name="incidentId" value={String(incidentId)} />
                <input type="hidden" name="attachmentId" value={String(asset.id)} />
                <button className="rounded-md border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                  Delete attachment
                </button>
              </form>
            ) : null}
          </figure>
        ))}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">
                Attachment #{selected.id} ({selectedIdx! + 1}/{attachments.length})
              </p>
              <button
                type="button"
                onClick={() => setSelectedIdx(null)}
                className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
              <div className="overflow-hidden rounded-xl bg-slate-50 p-2">
                {selected.publicUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selected.publicUrl}
                    alt={`Attachment ${selected.id}`}
                    className="max-h-[70vh] w-full rounded-lg object-contain"
                  />
                ) : (
                  <div className="flex h-72 items-center justify-center rounded-md bg-slate-100 text-sm text-slate-500">
                    Preview unavailable
                  </div>
                )}
                {hasMultiple ? (
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={goPrev}
                      className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </div>
              <aside className="rounded-xl border border-slate-100 p-3">
                <h3 className="text-sm font-semibold text-slate-900">Metadata</h3>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {metadata?.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

