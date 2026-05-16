import { redirect } from "next/navigation";
import Link from "next/link";
import { PortalBackButton } from "@/components/portal/portal-back-button";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { PortalPage, PortalPageBody, PortalPageHeader } from "@/components/portal/portal-page-layout";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { getSessionFromCookies } from "@/lib/server-session";

type Site = {
  id: number;
  name: string;
  address?: string;
  centerLat: number;
  centerLng: number;
  geofenceRadiusM?: number | null;
  geofencePolygon?: unknown;
};

type Checkpoints = {
  items: Array<{ id: number; label: string; qrCode: string; lat: number; lng: number; sortOrder: number }>;
};

export default async function AdminSiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/forbidden");

  const { id } = await params;
  const siteId = Number(id);
  const [siteRes, checkpointsRes] = await Promise.all([
    backendApiWithSession<Site>(`/sites/${siteId}`, session),
    backendApiWithSession<Checkpoints>(`/sites/${siteId}/checkpoints`, session),
  ]);

  const site = siteRes.data;
  if (!siteRes.ok) {
    return (
      <PortalPage>
        <PortalPageHeader
          title="Site detail"
          actions={
            <PortalBackButton fallbackHref="/admin/sites" className="lunar-btn-secondary lunar-btn-sm">
              Back
            </PortalBackButton>
          }
        >
          <ApiErrorNotice errors={[apiErrorMessage("Site detail", siteRes)]} />
        </PortalPageHeader>
      </PortalPage>
    );
  }
  if (!site) redirect("/admin/sites");

  const checkpoints = checkpointsRes.data?.items ?? [];
  const loadErrors = [apiErrorMessage("Checkpoints", checkpointsRes)];

  return (
    <PortalPage>
      <PortalPageHeader
        title={site.name}
        description={site.address?.trim() || "No address on file"}
        actions={
          <>
            <PortalBackButton fallbackHref="/admin/sites" className="lunar-btn-secondary lunar-btn-sm">
              Back
            </PortalBackButton>
            <Link href={`/admin/checkpoints?siteId=${siteId}`} className="lunar-btn-primary lunar-btn-sm">
              Manage checkpoints
            </Link>
          </>
        }
      >
        <ApiErrorNotice errors={loadErrors} />
        <p className="text-sm tabular-nums text-slate-600">
          {Number(site.centerLat).toFixed(5)}, {Number(site.centerLng).toFixed(5)}
          {site.geofenceRadiusM ? ` · ${site.geofenceRadiusM} m geofence` : ""}
        </p>
      </PortalPageHeader>
      <PortalPageBody padded>
        <section className="lunar-card lunar-card-pad print:shadow-none">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-slate-900">Checkpoint QR sheet</h3>
              <p className="text-sm text-slate-500">
                {checkpoints.length} checkpoint{checkpoints.length === 1 ? "" : "s"} — print and place at each patrol
                point.
              </p>
            </div>
            <span className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 print:hidden">
              Use browser print
            </span>
          </div>
          {checkpoints.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No checkpoints yet.{" "}
              <Link href={`/admin/checkpoints?siteId=${siteId}`} className="font-semibold text-lunar-700 hover:underline">
                Add checkpoints
              </Link>
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {checkpoints.map((cp) => (
                <div key={cp.id} className="rounded-xl border border-slate-200 p-4 text-center">
                  <p className="font-semibold text-slate-900">{cp.label}</p>
                  <img
                    alt={`QR code for ${cp.label}`}
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(cp.qrCode)}`}
                    className="mx-auto mt-3 h-28 w-28 rounded-lg border border-slate-300 bg-white p-1"
                  />
                  <p className="mt-2 text-xs tabular-nums text-slate-500">
                    {cp.lat}, {cp.lng}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </PortalPageBody>
    </PortalPage>
  );
}
