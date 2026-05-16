import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckpointPlaceFields } from "@/components/checkpoints/checkpoint-place-fields";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import {
  PortalPage,
  PortalPageBody,
  PortalPageHeader,
  PortalPageTableBody,
} from "@/components/portal/portal-page-layout";
import { PortalModal } from "@/components/portal/portal-modal";
import { PortalTableToolbar } from "@/components/portal/portal-table-toolbar";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { filterByQuery } from "@/lib/portal-table";
import { mutateBackend } from "@/lib/portal-mutations";
import { getSessionFromCookies } from "@/lib/server-session";
import { CheckpointQrClient } from "@/components/checkpoints/checkpoint-qr-client";

type SitesResponse = { items: Array<{ id: number; name: string }> };
type CheckpointResponse = {
  items: Array<{ id: number; label: string; qrCode: string; lat: number; lng: number; sortOrder: number }>;
};

type CheckpointsPageProps = {
  searchParams: Promise<{ siteId?: string; qr?: string; q?: string }>;
};

export default async function AdminCheckpointsPage({ searchParams }: CheckpointsPageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/forbidden");

  const params = await searchParams;
  const sitesRes = await backendApiWithSession<SitesResponse>("/sites?limit=200", session);
  const sites = sitesRes.data?.items ?? [];
  const siteId = Number(params.siteId) || sites[0]?.id;
  const selectedSite = sites.find((s) => s.id === siteId);
  const checkpointsRes = siteId
    ? await backendApiWithSession<CheckpointResponse>(`/sites/${siteId}/checkpoints`, session)
    : null;
  const allCheckpoints = checkpointsRes?.data?.items ?? [];
  const searchQuery = (params.q ?? "").trim();
  const checkpoints = filterByQuery(allCheckpoints, searchQuery, (cp) =>
    [cp.label, cp.qrCode, String(cp.lat), String(cp.lng), String(cp.sortOrder)].join(" "),
  );
  const loadErrors = [
    apiErrorMessage("Sites", sitesRes),
    apiErrorMessage("Checkpoints", checkpointsRes),
  ];

  async function createCheckpointAction(formData: FormData) {
    "use server";
    const sid = Number(formData.get("siteId"));
    const label = String(formData.get("label") ?? "").trim();
    const lat = Number(formData.get("lat"));
    const lng = Number(formData.get("lng"));
    const sortOrder = Number(formData.get("sortOrder"));
    const qrCode = String(formData.get("qrCode") ?? "").trim();
    if (!sid || !label || Number.isNaN(lat) || Number.isNaN(lng)) return;
    await mutateBackend(`/sites/${sid}/checkpoints`, "POST", {
      label,
      ...(qrCode ? { qrCode } : {}),
      lat,
      lng,
      sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
    });
    revalidatePath(`/admin/checkpoints?siteId=${sid}`);
  }

  async function deleteCheckpointAction(formData: FormData) {
    "use server";
    const id = Number(formData.get("id"));
    const sid = Number(formData.get("siteId"));
    if (!id) return;
    await mutateBackend(`/checkpoints/${id}`, "DELETE");
    revalidatePath(`/admin/checkpoints?siteId=${sid}`);
  }

  async function updateCheckpointAction(formData: FormData) {
    "use server";
    const id = Number(formData.get("id"));
    const sid = Number(formData.get("siteId"));
    const label = String(formData.get("label") ?? "").trim();
    const qrCode = String(formData.get("qrCode") ?? "").trim();
    const lat = Number(formData.get("lat"));
    const lng = Number(formData.get("lng"));
    const sortOrder = Number(formData.get("sortOrder"));
    if (!id || !label || !qrCode || Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(sortOrder)) return;
    await mutateBackend(`/checkpoints/${id}`, "PATCH", { label, qrCode, lat, lng, sortOrder });
    revalidatePath(`/admin/checkpoints?siteId=${sid}`);
  }

  const headerActions = siteId ? (
    <PortalModal
      triggerLabel="Add Checkpoint"
      title="Add checkpoint"
      description="Set the QR payload and coordinates for this patrol point."
      triggerClassName="lunar-btn-primary lunar-btn-sm"
    >
      <form action={createCheckpointAction} className="space-y-3">
        <input type="hidden" name="siteId" value={String(siteId)} />
        <CheckpointPlaceFields />
        <input
          name="qrCode"
          placeholder="Optional QR payload (default: auto = checkpoint ID)"
          className="lunar-input"
        />
        <input name="sortOrder" type="number" placeholder="Sort order (default 0)" className="lunar-input" />
        <button className="lunar-btn-primary w-full">Save Checkpoint</button>
      </form>
    </PortalModal>
  ) : null;

  return (
    <PortalPage>
      <PortalPageHeader
        title="Checkpoint management"
        description={
          selectedSite
            ? `${checkpoints.length} of ${allCheckpoints.length} checkpoint${allCheckpoints.length === 1 ? "" : "s"} · ${selectedSite.name}`
            : "Select a site to manage patrol QR checkpoints."
        }
        actions={headerActions}
      >
        <ApiErrorNotice errors={loadErrors} />
        {siteId ? (
          <PortalTableToolbar
            basePath="/admin/checkpoints"
            preserved={{ siteId: String(siteId) }}
            resetHref={`/admin/checkpoints?siteId=${siteId}`}
            fields={[
              {
                type: "search",
                placeholder: "Search label, QR code, coordinates…",
                defaultValue: searchQuery,
              },
              {
                type: "select",
                name: "siteId",
                label: "Site",
                defaultValue: String(siteId),
                options: sites.map((site) => ({ value: String(site.id), label: site.name })),
              },
            ]}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {sites.map((site) => (
              <Link
                key={site.id}
                href={`/admin/checkpoints?siteId=${site.id}`}
                className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                {site.name}
              </Link>
            ))}
          </div>
        )}
      </PortalPageHeader>

      {siteId ? (
        <PortalPageTableBody>
            <div className="lunar-table-wrap min-h-0 flex-1 overflow-auto rounded-none border-0 bg-transparent">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">Label</th>
                    <th className="px-3 py-3">QR code</th>
                    <th className="px-3 py-3">Latitude</th>
                    <th className="px-3 py-3">Longitude</th>
                    <th className="px-3 py-3">Sort</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {checkpoints.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                        {allCheckpoints.length === 0
                          ? "No checkpoints for this site yet."
                          : "No checkpoints match your search."}
                      </td>
                    </tr>
                  ) : null}
                  {checkpoints.map((cp) => (
                    <tr key={cp.id} className="border-b border-slate-100 align-top last:border-0 hover:bg-slate-50/60">
                      <td className="px-3 py-3">
                        <input
                          form={`cp-update-${cp.id}`}
                          name="label"
                          defaultValue={cp.label}
                          className="min-w-[10rem] lunar-input-sm"
                          aria-label="Checkpoint label"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          form={`cp-update-${cp.id}`}
                          name="qrCode"
                          defaultValue={cp.qrCode}
                          className="min-w-[9rem] font-mono text-xs lunar-input-sm"
                          aria-label="QR code"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          form={`cp-update-${cp.id}`}
                          name="lat"
                          type="number"
                          step="any"
                          defaultValue={cp.lat}
                          className="w-28 tabular-nums lunar-input-sm"
                          aria-label="Latitude"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          form={`cp-update-${cp.id}`}
                          name="lng"
                          type="number"
                          step="any"
                          defaultValue={cp.lng}
                          className="w-28 tabular-nums lunar-input-sm"
                          aria-label="Longitude"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          form={`cp-update-${cp.id}`}
                          name="sortOrder"
                          type="number"
                          defaultValue={cp.sortOrder}
                          className="w-16 lunar-input-sm"
                          aria-label="Sort order"
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Link
                            href={`/admin/checkpoints?siteId=${siteId}&qr=${cp.id}`}
                            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            QR
                          </Link>
                          <form id={`cp-update-${cp.id}`} action={updateCheckpointAction}>
                            <input type="hidden" name="id" value={String(cp.id)} />
                            <input type="hidden" name="siteId" value={String(siteId)} />
                            <button className="rounded-md border border-lunar-200 px-3 py-1 text-xs font-semibold text-lunar-700 hover:bg-lunar-50">
                              Save
                            </button>
                          </form>
                          <form action={deleteCheckpointAction}>
                            <input type="hidden" name="id" value={String(cp.id)} />
                            <input type="hidden" name="siteId" value={String(siteId)} />
                            <button className="rounded-md border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                              Delete
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </PortalPageTableBody>
      ) : (
        <PortalPageBody padded>
          <p className="text-sm text-slate-500">No sites found. Create a site first in Admin &gt; Sites.</p>
        </PortalPageBody>
      )}
      {siteId ? <CheckpointQrClient siteId={siteId} checkpoints={checkpoints} /> : null}
    </PortalPage>
  );
}

