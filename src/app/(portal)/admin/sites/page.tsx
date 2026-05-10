import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { backendApiWithSession } from "@/lib/backend";
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
    isActive: number | boolean;
  }>;
};

type AdminSitesPageProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

export default async function AdminSitesPage({ searchParams }: AdminSitesPageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/forbidden");

  const sitesRes = await backendApiWithSession<SitesResponse>("/sites", session);
  const allSites = sitesRes.data?.items ?? [];
  const params = await searchParams;
  const PAGE_SIZE = 12;
  const query = (params.q ?? "").trim().toLowerCase();
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
    if (!name || Number.isNaN(centerLat) || Number.isNaN(centerLng)) return;
    await mutateBackend("/sites", "POST", {
      name,
      address: address || undefined,
      centerLat,
      centerLng,
      geofenceRadiusM: Number.isNaN(geofenceRadiusM) ? undefined : geofenceRadiusM,
      isActive: true,
    });
    revalidatePath("/admin/sites");
  }

  async function deactivateSiteAction(formData: FormData) {
    "use server";
    const id = Number(formData.get("id"));
    if (!id) return;
    await mutateBackend(`/sites/${id}`, "DELETE");
    revalidatePath("/admin/sites");
  }

  async function updateSiteAction(formData: FormData) {
    "use server";
    const id = Number(formData.get("id"));
    const name = String(formData.get("name") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim();
    const centerLat = Number(formData.get("centerLat"));
    const centerLng = Number(formData.get("centerLng"));
    const geofenceRadiusM = Number(formData.get("geofenceRadiusM"));
    const isActive = String(formData.get("isActive") ?? "true") === "true";
    if (!id || !name || Number.isNaN(centerLat) || Number.isNaN(centerLng)) return;
    await mutateBackend(`/sites/${id}`, "PATCH", {
      name,
      address: address || undefined,
      centerLat,
      centerLng,
      geofenceRadiusM: Number.isNaN(geofenceRadiusM) ? null : geofenceRadiusM,
      isActive,
    });
    revalidatePath("/admin/sites");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Create site</h2>
        <p className="text-sm text-slate-500">Adds a new patrol site and geofence center.</p>
        <form action={createSiteAction} className="mt-4 space-y-3">
          <input
            name="name"
            required
            placeholder="Site name"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
          />
          <input
            name="address"
            placeholder="Address"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              name="centerLat"
              type="number"
              step="any"
              required
              placeholder="Latitude"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
            />
            <input
              name="centerLng"
              type="number"
              step="any"
              required
              placeholder="Longitude"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
            />
          </div>
          <input
            name="geofenceRadiusM"
            type="number"
            min="1"
            placeholder="Geofence radius (m)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
          />
          <button className="w-full rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lunar-800">
            Create Site
          </button>
        </form>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Sites</h2>
        <form className="mt-3">
          <input
            name="q"
            defaultValue={query}
            placeholder="Search name, address, coordinates"
            className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
          />
        </form>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
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
                <tr key={site.id} className="border-t border-slate-100">
                  <td className="py-2.5">
                    <input
                      form={`site-update-${site.id}`}
                      name="name"
                      defaultValue={site.name}
                      className="w-40 rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                    <input
                      form={`site-update-${site.id}`}
                      name="address"
                      defaultValue={site.address ?? ""}
                      className="mt-1 w-40 rounded-md border border-slate-300 px-2 py-1 text-xs"
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

