import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { PortalModal } from "@/components/portal/portal-modal";
import { SubmitButton } from "@/components/portal/submit-button";
import { SitePlaceFields } from "@/components/sites/site-place-fields";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { mutateBackend } from "@/lib/portal-mutations";
import { getSessionFromCookies } from "@/lib/server-session";

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
};

type AdminSitesPageProps = {
  searchParams: Promise<{ q?: string; page?: string; success?: string; error?: string }>;
};

export default async function AdminSitesPage({ searchParams }: AdminSitesPageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/forbidden");

  const sitesRes = await backendApiWithSession<SitesResponse>("/sites", session);
  const allSites = sitesRes.data?.items ?? [];
  const loadErrors = [apiErrorMessage("Sites", sitesRes)];
  const params = await searchParams;
  const PAGE_SIZE = 12;
  const query = (params.q ?? "").trim().toLowerCase();
  const actionSuccess = (params.success ?? "").trim();
  const actionError = (params.error ?? "").trim();
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const filtered = query
    ? allSites.filter((site) =>
        [site.name, site.address ?? "", `${site.centerLat}`, `${site.centerLng}`]
          .join(" ")
          .toLowerCase()
          .includes(query)
      )
    : allSites;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const sites = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
    <div className="grid gap-4 2xl:grid-cols-[420px_1fr]">
      {actionSuccess || actionError ? (
        <div className="2xl:col-span-2">
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
        </div>
      ) : null}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Create site</h2>
        <p className="mt-1 text-sm text-slate-500">
          Add patrol sites with Google address search, coordinates, and geofence data.
        </p>
        <div className="mt-4 rounded-xl border border-lunar-100 bg-lunar-50 p-4 text-sm text-lunar-900">
          Start from a Google place/address to fill the site name, address, latitude, and longitude automatically.
        </div>
        <div className="mt-4">
          <PortalModal
            triggerLabel="Create Site"
            title="Create site"
            description="Search for a real address, verify coordinates, then save the patrol geofence."
            triggerClassName="w-full rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lunar-800"
          >
            <form action={createSiteAction} className="space-y-3">
              <SitePlaceFields />
              <input
                name="geofenceRadiusM"
                type="number"
                min="1"
                placeholder="Geofence radius (m)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
              />
              <textarea
                name="geofencePolygon"
                placeholder='Optional polygon JSON, e.g. [{"lat":51.5,"lng":-0.1}]'
                className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
              />
              <SubmitButton pendingLabel="Creating site...">
                Save Site
              </SubmitButton>
            </form>
          </PortalModal>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Sites</h2>
        <div className="mt-3">
          <ApiErrorNotice errors={loadErrors} />
        </div>
        <form className="mt-3">
          <input
            name="q"
            defaultValue={query}
            placeholder="Search name, address, coordinates"
            className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
          />
        </form>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="pb-2">Name</th>
                <th className="pb-2">Location</th>
                <th className="pb-2">Radius</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => (
                <tr key={site.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                  <td className="py-2.5">
                    <input
                      form={`site-update-${site.id}`}
                      name="name"
                      defaultValue={site.name}
                      className="w-40 rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                    <Link href={`/admin/sites/${site.id}`} className="mt-1 block text-xs font-semibold text-lunar-700 hover:underline">
                      Assets, checkpoints, QR sheet
                    </Link>
                    <input
                      form={`site-update-${site.id}`}
                      name="address"
                      defaultValue={site.address ?? ""}
                      className="mt-1 w-40 rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="hidden">
                    <textarea
                      form={`site-update-${site.id}`}
                      name="geofencePolygon"
                      defaultValue={site.geofencePolygon ? JSON.stringify(site.geofencePolygon) : ""}
                    />
                  </td>
                  <td className="py-2.5 text-slate-700">
                    <div className="flex gap-1">
                      <input
                        form={`site-update-${site.id}`}
                        name="centerLat"
                        type="number"
                        step="any"
                        defaultValue={site.centerLat}
                        className="w-20 rounded-md border border-slate-300 px-2 py-1 text-xs"
                      />
                      <input
                        form={`site-update-${site.id}`}
                        name="centerLng"
                        type="number"
                        step="any"
                        defaultValue={site.centerLng}
                        className="w-20 rounded-md border border-slate-300 px-2 py-1 text-xs"
                      />
                    </div>
                  </td>
                  <td className="py-2.5">
                    <input
                      form={`site-update-${site.id}`}
                      name="geofenceRadiusM"
                      type="number"
                      defaultValue={site.geofenceRadiusM ?? ""}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="py-2.5">
                    <select
                      form={`site-update-${site.id}`}
                      name="isActive"
                      defaultValue={Number(site.isActive) ? "true" : "false"}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <form id={`site-update-${site.id}`} action={updateSiteAction}>
                        <input type="hidden" name="id" value={String(site.id)} />
                        <button className="rounded-md border border-lunar-200 px-3 py-1 text-xs font-semibold text-lunar-700 hover:bg-lunar-50">
                          Save
                        </button>
                      </form>
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
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-slate-500">
            Showing {sites.length} of {filtered.length} sites
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
      </section>
    </div>
  );
}

