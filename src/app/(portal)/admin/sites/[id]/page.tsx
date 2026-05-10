import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { PortalModal } from "@/components/portal/portal-modal";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { mutateBackend } from "@/lib/portal-mutations";
import { getSessionFromCookies } from "@/lib/server-session";

type Site = { id: number; name: string; address?: string; centerLat: number; centerLng: number; geofencePolygon?: unknown };
type Checkpoints = { items: Array<{ id: number; label: string; qrCode: string; lat: number; lng: number; sortOrder: number }> };
type Assets = { items: Array<{ id: number; name: string; assetType: string; status: string; lat?: number; lng?: number; notes?: string }> };

export default async function AdminSiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/forbidden");
  const { id } = await params;
  const siteId = Number(id);
  const [siteRes, checkpointsRes, assetsRes] = await Promise.all([
    backendApiWithSession<Site>(`/sites/${siteId}`, session),
    backendApiWithSession<Checkpoints>(`/sites/${siteId}/checkpoints`, session),
    backendApiWithSession<Assets>(`/sites/${siteId}/assets`, session),
  ]);
  const site = siteRes.data;
  if (!siteRes.ok) {
    return (
      <div className="space-y-4">
        <Link href="/admin/sites" className="text-sm font-semibold text-lunar-700 hover:underline">Back to sites</Link>
        <ApiErrorNotice errors={[apiErrorMessage("Site detail", siteRes)]} />
      </div>
    );
  }
  if (!site) redirect("/admin/sites");
  const checkpoints = checkpointsRes.data?.items ?? [];
  const assets = assetsRes.data?.items ?? [];
  const loadErrors = [
    apiErrorMessage("Checkpoints", checkpointsRes),
    apiErrorMessage("Assets", assetsRes),
  ];

  async function addAssetAction(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    const assetType = String(formData.get("assetType") ?? "").trim();
    const lat = Number(formData.get("lat"));
    const lng = Number(formData.get("lng"));
    const notes = String(formData.get("notes") ?? "").trim();
    if (!name || !assetType) return;
    await mutateBackend(`/sites/${siteId}/assets`, "POST", {
      name,
      assetType,
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
      notes: notes || undefined,
    });
    revalidatePath(`/admin/sites/${siteId}`);
  }

  return (
    <div className="space-y-4">
      <Link href="/admin/sites" className="text-sm font-semibold text-lunar-700 hover:underline">Back to sites</Link>
      <ApiErrorNotice errors={loadErrors} />
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{site.name}</h2>
        <p className="text-sm text-slate-500">{site.address ?? "No address"} • {site.centerLat}, {site.centerLng}</p>
        <pre className="mt-3 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          {site.geofencePolygon ? JSON.stringify(site.geofencePolygon, null, 2) : "No polygon saved. Use the sites list to paste polygon JSON."}
        </pre>
      </section>

      <section className="grid gap-4 2xl:grid-cols-[360px_1fr]">
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900">Asset inventory</h3>
          <p className="mt-1 text-sm text-slate-500">Track CCTV, keys, gates, first-aid points, and other site assets.</p>
          <div className="mt-3">
            <PortalModal
              triggerLabel="Add Asset"
              title="Add site asset"
              description="Add asset details and optional coordinates for this site."
              triggerClassName="w-full rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white"
            >
              <form action={addAssetAction} className="grid gap-2">
                <input name="name" required placeholder="Asset name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input name="assetType" required placeholder="CCTV, gate, first aid, key safe..." className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <input name="lat" type="number" step="any" placeholder="Lat" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <input name="lng" type="number" step="any" placeholder="Lng" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <textarea name="notes" placeholder="Notes" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <button className="rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white">Save Asset</button>
              </form>
            </PortalModal>
          </div>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900">Assets</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {assets.map((asset) => (
              <div key={asset.id} className="rounded-xl border border-slate-100 p-3 text-sm">
                <p className="font-semibold text-slate-900">{asset.name}</p>
                <p className="text-slate-500">{asset.assetType} • {asset.status}</p>
                <p className="text-xs text-slate-500">{asset.lat ?? "-"}, {asset.lng ?? "-"}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm print:shadow-none">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-slate-900">Printable checkpoint QR sheet</h3>
            <p className="text-sm text-slate-500">Print this page and place each QR code at the matching checkpoint.</p>
          </div>
          <span className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 print:hidden">
            Use browser print
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {checkpoints.map((cp) => (
            <div key={cp.id} className="rounded-xl border border-slate-200 p-4 text-center">
              <p className="font-semibold text-slate-900">{cp.label}</p>
              <img
                alt={`QR code for ${cp.label}`}
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(cp.qrCode)}`}
                className="mx-auto mt-3 h-28 w-28 rounded-lg border border-slate-300 bg-white p-1"
              />
              <p className="mt-2 text-xs text-slate-500">{cp.lat}, {cp.lng}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
