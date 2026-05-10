import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { backendApiWithSession } from "@/lib/backend";
import { mutateBackend } from "@/lib/portal-mutations";
import { getSessionFromCookies } from "@/lib/server-session";

type IncidentsResponse = {
  items: Array<{
    id: number;
    userId: number;
    siteId: number;
    category: string;
    title: string;
    status: "open" | "in_review" | "closed";
    createdAt: string;
  }>;
};

type SosResponse = {
  items: Array<{
    id: number;
    userId: number;
    lat: number;
    lng: number;
    message?: string;
    status: "active" | "acknowledged" | "resolved";
    createdAt: string;
  }>;
};

type SiteList = {
  items: Array<{ id: number; name: string }>;
};

type ManagerIncidentsPageProps = {
  searchParams: Promise<{ q?: string; page?: string; status?: string; siteId?: string }>;
};

export default async function ManagerIncidentsPage({ searchParams }: ManagerIncidentsPageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!["admin", "supervisor"].includes(session.user.role)) redirect("/forbidden");

  const params = await searchParams;
  const statusFilter = (params.status ?? "").trim();
  const siteIdFilter = Number(params.siteId ?? "");
  const [incidentsRes, sosRes, sitesRes] = await Promise.all([
    backendApiWithSession<IncidentsResponse>(
      `/incidents${statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : ""}`,
      session
    ),
    backendApiWithSession<SosResponse>("/sos", session),
    backendApiWithSession<SiteList>("/sites", session),
  ]);
  const allIncidents = incidentsRes.data?.items ?? [];
  const sites = sitesRes.data?.items ?? [];
  const query = (params.q ?? "").trim().toLowerCase();
  const filteredBySite = siteIdFilter
    ? allIncidents.filter((incident) => incident.siteId === siteIdFilter)
    : allIncidents;
  const filtered = query
    ? filteredBySite.filter((incident) =>
        [incident.title, incident.category, `${incident.siteId}`, `${incident.userId}`]
          .join(" ")
          .toLowerCase()
          .includes(query)
      )
    : filteredBySite;
  const PAGE_SIZE = 12;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const incidents = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const sosEvents = sosRes.data?.items ?? [];

  async function updateIncidentStatusAction(formData: FormData) {
    "use server";
    const id = Number(formData.get("id"));
    const status = String(formData.get("status") ?? "");
    if (!id || !status) return;
    await mutateBackend(`/incidents/${id}`, "PATCH", { status });
    revalidatePath("/manager/incidents");
  }

  async function updateSosStatusAction(formData: FormData) {
    "use server";
    const id = Number(formData.get("id"));
    const status = String(formData.get("status") ?? "");
    if (!id || !status) return;
    await mutateBackend(`/sos/${id}`, "PATCH", { status });
    revalidatePath("/manager/incidents");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Incidents</h2>
        <form className="mt-3 grid gap-2 sm:grid-cols-4">
          <input
            name="q"
            defaultValue={query}
            placeholder="Search title/category"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400 sm:col-span-2"
          />
          <select
            name="status"
            defaultValue={statusFilter}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
          >
            <option value="">All statuses</option>
            <option value="open">open</option>
            <option value="in_review">in_review</option>
            <option value="closed">closed</option>
          </select>
          <select
            name="siteId"
            defaultValue={siteIdFilter ? String(siteIdFilter) : ""}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
          >
            <option value="">All sites</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </form>
        <ul className="mt-3 space-y-2">
          {incidents.map((incident) => (
            <li key={incident.id} className="rounded-lg border border-slate-100 p-3">
              <p className="text-sm font-semibold text-slate-900">
                <Link href={`/manager/incidents/${incident.id}`} className="hover:underline">
                  #{incident.id} {incident.title}
                </Link>
              </p>
              <p className="text-xs text-slate-600">
                {incident.category} • Site {incident.siteId} • Guard {incident.userId}
              </p>
              <p className="mt-1 text-xs text-slate-500">{new Date(incident.createdAt).toLocaleString()}</p>
              <form action={updateIncidentStatusAction} className="mt-2 flex items-center gap-2">
                <input type="hidden" name="id" value={String(incident.id)} />
                <select
                  name="status"
                  defaultValue={incident.status}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-lunar-400"
                >
                  <option value="open">open</option>
                  <option value="in_review">in_review</option>
                  <option value="closed">closed</option>
                </select>
                <button className="rounded-md bg-lunar-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-lunar-800">
                  Update
                </button>
              </form>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-slate-500">
            Showing {incidents.length} of {filtered.length} incidents
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={`/manager/incidents?page=${Math.max(1, currentPage - 1)}&q=${encodeURIComponent(query)}&status=${encodeURIComponent(statusFilter)}&siteId=${siteIdFilter || ""}`}
              className={`rounded-md border px-3 py-1 ${currentPage <= 1 ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            >
              Prev
            </Link>
            <span className="text-slate-600">
              Page {currentPage} / {totalPages}
            </span>
            <Link
              href={`/manager/incidents?page=${Math.min(totalPages, currentPage + 1)}&q=${encodeURIComponent(query)}&status=${encodeURIComponent(statusFilter)}&siteId=${siteIdFilter || ""}`}
              className={`rounded-md border px-3 py-1 ${currentPage >= totalPages ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            >
              Next
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">SOS Events</h2>
        <ul className="mt-3 space-y-2">
          {sosEvents.map((event) => (
            <li key={event.id} className="rounded-lg border border-slate-100 p-3">
              <p className="text-sm font-semibold text-slate-900">SOS #{event.id}</p>
              <p className="text-xs text-slate-600">
                Guard {event.userId} • {event.lat}, {event.lng}
              </p>
              {event.message ? <p className="mt-1 text-xs text-slate-700">{event.message}</p> : null}
              <p className="mt-1 text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
              <form action={updateSosStatusAction} className="mt-2 flex items-center gap-2">
                <input type="hidden" name="id" value={String(event.id)} />
                <select
                  name="status"
                  defaultValue={event.status}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-lunar-400"
                >
                  <option value="acknowledged">acknowledged</option>
                  <option value="resolved">resolved</option>
                </select>
                <button className="rounded-md bg-lunar-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-lunar-800">
                  Update
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

