import { revalidatePath } from "next/cache";
import Link from "next/link";
import { PortalDetailLink } from "@/components/portal/portal-detail-link";
import { redirect } from "next/navigation";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { PortalModal } from "@/components/portal/portal-modal";
import { PortalPage, PortalPageBody, PortalPageHeader } from "@/components/portal/portal-page-layout";
import { SubmitButton } from "@/components/portal/submit-button";
import { SiteEditForm } from "@/components/sites/site-edit-form";
import { SiteGeofenceFields } from "@/components/sites/site-geofence-fields";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { mutateBackend } from "@/lib/portal-mutations";
import { getSessionFromCookies } from "@/lib/server-session";
import { buildTrainingBySite } from "@/lib/training-by-site";

type SitesResponse = {
  items: Array<{
    id: number;
    name: string;
    address?: string;
    centerLat: number;
    centerLng: number;
    geofenceRadiusM?: number;
    geofencePolygon?: unknown;
    isActive: number | boolean;
  }>;
  page?: number;
  limit?: number;
  total?: number;
};

type TrainingAssignmentsResponse = {
  items: Array<{ userId: number; siteId: number }>;
};

type AdminSitesPageProps = {
  searchParams: Promise<{ q?: string; page?: string; success?: string; error?: string }>;
};

const PAGE_SIZE = 50;

export default async function AdminSitesPage({ searchParams }: AdminSitesPageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/forbidden");

  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const actionSuccess = (params.success ?? "").trim();
  const actionError = (params.error ?? "").trim();
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const sitesQuery = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE),
  });
  if (query) sitesQuery.set("q", query);

  const [sitesRes, trainingRes] = await Promise.all([
    backendApiWithSession<SitesResponse>(`/sites?${sitesQuery}`, session),
    backendApiWithSession<TrainingAssignmentsResponse>("/training/assignments", session),
  ]);
  const sites = sitesRes.data?.items ?? [];
  const trainingBySite = buildTrainingBySite(trainingRes.data?.items ?? []);
  const trainedCountBySite = (siteId: number) => trainingBySite[String(siteId)]?.length ?? 0;
  const totalCount = Number(sitesRes.data?.total ?? sites.length);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const loadErrors = [
    apiErrorMessage("Sites", sitesRes),
    apiErrorMessage("Training", trainingRes),
  ];

  async function createSiteAction(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim();
    const centerLat = Number(formData.get("centerLat"));
    const centerLng = Number(formData.get("centerLng"));
    const geofenceRadiusM = Number(formData.get("geofenceRadiusM"));
    const geofencePolygonRaw = String(formData.get("geofencePolygon") ?? "").trim();
    let geofencePolygon: unknown = undefined;
    if (geofencePolygonRaw) {
      try {
        geofencePolygon = JSON.parse(geofencePolygonRaw);
      } catch {
        redirect("/admin/sites?error=Invalid%20polygon%20JSON");
      }
    }
    if (!name || Number.isNaN(centerLat) || Number.isNaN(centerLng)) {
      redirect("/admin/sites?error=Site%20name%20and%20valid%20coordinates%20are%20required");
    }
    try {
      await mutateBackend("/sites", "POST", {
        name,
        address: address || undefined,
        centerLat,
        centerLng,
        geofenceRadiusM: Number.isNaN(geofenceRadiusM) ? undefined : geofenceRadiusM,
        geofencePolygon,
        isActive: true,
      });
    } catch (e) {
      redirect(`/admin/sites?error=${encodeURIComponent(e instanceof Error ? e.message : "Unable to create site")}`);
    }
    revalidatePath("/admin/sites");
    redirect(`/admin/sites?success=${encodeURIComponent(`Site "${name}" created successfully`)}`);
  }

  async function deactivateSiteAction(formData: FormData) {
    "use server";
    const id = Number(formData.get("id"));
    if (!id) redirect("/admin/sites?error=Missing%20site%20id");
    try {
      await mutateBackend(`/sites/${id}`, "DELETE");
    } catch (e) {
      redirect(`/admin/sites?error=${encodeURIComponent(e instanceof Error ? e.message : "Unable to deactivate site")}`);
    }
    revalidatePath("/admin/sites");
    redirect("/admin/sites?success=Site%20deactivated");
  }

  async function updateSiteAction(formData: FormData) {
    "use server";
    const id = Number(formData.get("id"));
    const name = String(formData.get("name") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim();
    const centerLat = Number(formData.get("centerLat"));
    const centerLng = Number(formData.get("centerLng"));
    const geofenceRadiusM = Number(formData.get("geofenceRadiusM"));
    const geofencePolygonRaw = String(formData.get("geofencePolygon") ?? "").trim();
    let geofencePolygon: unknown = undefined;
    if (geofencePolygonRaw) {
      try {
        geofencePolygon = JSON.parse(geofencePolygonRaw);
      } catch {
        redirect("/admin/sites?error=Invalid%20polygon%20JSON");
      }
    }
    const isActive = String(formData.get("isActive") ?? "true") === "true";
    if (!id || !name || Number.isNaN(centerLat) || Number.isNaN(centerLng)) {
      redirect("/admin/sites?error=Site%20name%20and%20valid%20coordinates%20are%20required");
    }
    try {
      await mutateBackend(`/sites/${id}`, "PATCH", {
        name,
        address: address || undefined,
        centerLat,
        centerLng,
        geofenceRadiusM: Number.isNaN(geofenceRadiusM) ? null : geofenceRadiusM,
        geofencePolygon,
        isActive,
      });
    } catch (e) {
      redirect(`/admin/sites?error=${encodeURIComponent(e instanceof Error ? e.message : "Unable to update site")}`);
    }
    revalidatePath("/admin/sites");
    redirect(`/admin/sites?success=${encodeURIComponent(`Site "${name}" updated`)}`);
  }

  return (
    <PortalPage>
      <PortalPageHeader
        title="Sites"
        description="Patrol sites with geofences, coordinates, and checkpoint links."
        actions={
          <PortalModal
            triggerLabel="Create site"
            title="Create site"
            description="Search for an address, set the centre on the map, and draw the patrol geofence polygon."
            triggerClassName="lunar-btn-primary"
            size="xl"
          >
            <form action={createSiteAction} className="space-y-3">
              <SiteGeofenceFields />
              <SubmitButton pendingLabel="Creating site...">Save Site</SubmitButton>
            </form>
          </PortalModal>
        }
      >
        <ApiErrorNotice errors={loadErrors} />
        {actionSuccess ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {actionSuccess}
          </p>
        ) : null}
        {actionError ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {actionError}
          </p>
        ) : null}
        <form method="get" className="portal-filter-bar portal-filter-bar--search">
          <input
            name="q"
            defaultValue={query}
            placeholder="Search name, address, coordinates"
            className="min-w-0 w-full lunar-input"
          />
        </form>
      </PortalPageHeader>
      <PortalPageBody padded>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="lunar-table-wrap min-h-0 flex-1">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3">Site name</th>
                <th className="px-3 py-3">Trained guards</th>
                <th className="px-3 py-3">Address</th>
                <th className="px-3 py-3">Coordinates</th>
                <th className="px-3 py-3">Geofence (m)</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                    No sites match your search.
                  </td>
                </tr>
              ) : null}
              {sites.map((site) => {
                const trainedCount = trainedCountBySite(site.id);
                return (
                <tr key={site.id} className="border-b border-slate-100 align-top last:border-0 hover:bg-slate-50/60">
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-900">
                      <span className="mr-1.5 tabular-nums text-slate-500">({trainedCount})</span>
                      {site.name}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                      <PortalDetailLink
                        href={`/manager/sites/${site.id}`}
                        className="text-xs font-semibold text-lunar-700 hover:underline"
                      >
                        Ops dashboard
                      </PortalDetailLink>
                      <Link
                        href={`/admin/checkpoints?siteId=${site.id}`}
                        className="text-xs font-semibold text-lunar-700 hover:underline"
                      >
                        Checkpoints →
                      </Link>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/manager/training?siteId=${site.id}`}
                      className="tabular-nums font-semibold text-lunar-800 hover:underline"
                      title="View training assignments for this site"
                    >
                      {trainedCount}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    <p className="max-w-xs text-sm leading-snug">{site.address?.trim() || "—"}</p>
                  </td>
                  <td className="px-3 py-3 text-sm tabular-nums text-slate-700">
                    <p>{Number(site.centerLat).toFixed(5)}</p>
                    <p className="text-slate-500">{Number(site.centerLng).toFixed(5)}</p>
                  </td>
                  <td className="px-3 py-3 text-sm text-slate-700">
                    {site.geofenceRadiusM ?? "—"}
                    {site.geofenceRadiusM ? " m" : ""}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={
                        Number(site.isActive) ? "lunar-badge-success" : "lunar-badge-neutral"
                      }
                    >
                      {Number(site.isActive) ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <PortalModal
                        triggerLabel="Edit"
                        title={`Edit ${site.name}`}
                        description="Update site name, address, coordinates, and geofence."
                        triggerClassName="lunar-btn-secondary lunar-btn-sm"
                        size="xl"
                      >
                        <SiteEditForm
                          site={{
                            id: site.id,
                            name: site.name,
                            address: site.address,
                            centerLat: Number(site.centerLat),
                            centerLng: Number(site.centerLng),
                            geofenceRadiusM: site.geofenceRadiusM ?? null,
                            geofencePolygon: site.geofencePolygon,
                            isActive: Boolean(Number(site.isActive)),
                          }}
                          updateAction={updateSiteAction}
                        />
                      </PortalModal>
                      {Number(site.isActive) ? (
                        <form action={deactivateSiteAction}>
                          <input type="hidden" name="id" value={String(site.id)} />
                          <button className="rounded-md border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                            Deactivate
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-slate-400">Inactive</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex shrink-0 items-center justify-between border-t border-slate-100 pt-3 text-sm">
          <p className="text-slate-500">
            Showing {sites.length} of {totalCount} sites
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/sites?page=${Math.max(1, currentPage - 1)}&q=${encodeURIComponent(query)}`}
              className={`rounded-md border px-3 py-1 ${currentPage <= 1 ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            >
              Prev
            </Link>
            <span className="text-slate-600">
              Page {currentPage} / {totalPages}
            </span>
            <Link
              href={`/admin/sites?page=${Math.min(totalPages, currentPage + 1)}&q=${encodeURIComponent(query)}`}
              className={`rounded-md border px-3 py-1 ${currentPage >= totalPages ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            >
              Next
            </Link>
          </div>
        </div>
        </div>
      </PortalPageBody>
    </PortalPage>
  );
}

