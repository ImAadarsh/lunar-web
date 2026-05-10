import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { backendApiWithSession } from "@/lib/backend";
import { mutateBackend } from "@/lib/portal-mutations";
import { getSessionFromCookies } from "@/lib/server-session";
import { CheckpointQrClient } from "@/components/checkpoints/checkpoint-qr-client";

type SitesResponse = { items: Array<{ id: number; name: string }> };
type CheckpointResponse = {
  items: Array<{ id: number; label: string; qrCode: string; lat: number; lng: number; sortOrder: number }>;
};

type CheckpointsPageProps = {
  searchParams: Promise<{ siteId?: string; qr?: string }>;
};

export default async function AdminCheckpointsPage({ searchParams }: CheckpointsPageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/forbidden");

  const params = await searchParams;
  const sitesRes = await backendApiWithSession<SitesResponse>("/sites", session);
  const sites = sitesRes.data?.items ?? [];
  const siteId = Number(params.siteId) || sites[0]?.id;
  const checkpointsRes = siteId
    ? await backendApiWithSession<CheckpointResponse>(`/sites/${siteId}/checkpoints`, session)
    : null;
  const checkpoints = checkpointsRes?.data?.items ?? [];

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

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Checkpoint management</h2>
        <p className="text-sm text-slate-500">Select a site to manage patrol QR checkpoints.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {sites.map((site) => (
            <Link
              key={site.id}
              href={`/admin/checkpoints?siteId=${site.id}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${site.id === siteId ? "bg-lunar-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            >
              {site.name}
            </Link>
          ))}
        </div>
      </section>

      {siteId ? (
        <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Add checkpoint</h3>
            <form action={createCheckpointAction} className="mt-3 space-y-3">
              <input type="hidden" name="siteId" value={String(siteId)} />
              <input
                name="label"
                required
                placeholder="Checkpoint label"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
              />
              <input
                name="qrCode"
                placeholder="Optional QR payload (default: auto = checkpoint ID)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
              />
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
                name="sortOrder"
                type="number"
                placeholder="Sort order (default 0)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
              />
              <button className="w-full rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lunar-800">
                Add Checkpoint
              </button>
            </form>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Checkpoints</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="pb-2">Label</th>
                    <th className="pb-2">QR</th>
                    <th className="pb-2">Location</th>
                    <th className="pb-2">Sort</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {checkpoints.map((cp) => (
                    <tr key={cp.id} className="border-t border-slate-100">
                      <td className="py-2.5">
                        <input
                          form={`cp-update-${cp.id}`}
                          name="label"
                          defaultValue={cp.label}
                          className="w-28 rounded-md border border-slate-300 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="py-2.5">
                        <input
                          form={`cp-update-${cp.id}`}
                          name="qrCode"
                          defaultValue={cp.qrCode}
                          className="w-32 rounded-md border border-slate-300 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="py-2.5">
                        <div className="flex gap-1">
                          <input
                            form={`cp-update-${cp.id}`}
                            name="lat"
                            type="number"
                            step="any"
                            defaultValue={cp.lat}
                            className="w-20 rounded-md border border-slate-300 px-2 py-1 text-xs"
                          />
                          <input
                            form={`cp-update-${cp.id}`}
                            name="lng"
                            type="number"
                            step="any"
                            defaultValue={cp.lng}
                            className="w-20 rounded-md border border-slate-300 px-2 py-1 text-xs"
                          />
                        </div>
                      </td>
                      <td className="py-2.5">
                        <input
                          form={`cp-update-${cp.id}`}
                          name="sortOrder"
                          type="number"
                          defaultValue={cp.sortOrder}
                          className="w-16 rounded-md border border-slate-300 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
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
          </section>
        </div>
      ) : (
        <section className="rounded-2xl bg-white p-5 shadow-sm text-sm text-slate-500">
          No sites found. Create a site first in Admin &gt; Sites.
        </section>
      )}
      {siteId ? <CheckpointQrClient siteId={siteId} checkpoints={checkpoints} /> : null}
    </div>
  );
}

