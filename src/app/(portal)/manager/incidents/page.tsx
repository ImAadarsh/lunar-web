import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PortalDetailLink } from "@/components/portal/portal-detail-link";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { DetailTable } from "@/components/portal/detail-table";
import { PortalModal } from "@/components/portal/portal-modal";
import {
  PortalPage,
  PortalPageHeader,
  PortalPageTableBody,
} from "@/components/portal/portal-page-layout";
import { PortalTabNav } from "@/components/portal/portal-tab-nav";
import { PortalTableToolbar } from "@/components/portal/portal-table-toolbar";
import { StatusBadge } from "@/components/portal/status-badge";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { formatUkDateTime } from "@/lib/format-datetime";
import { filterByQuery } from "@/lib/portal-table";
import { mutateBackend } from "@/lib/portal-mutations";
import { getSessionFromCookies } from "@/lib/server-session";

type IncidentsResponse = {
  items: Array<{
    id: number;
    userId: number;
    siteId: number;
    siteName?: string;
    userEmail?: string;
    userPhone?: string | null;
    guardName?: string | null;
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
    userEmail?: string;
    userPhone?: string | null;
    guardName?: string | null;
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

const BASE_PATH = "/manager/incidents";

type ManagerIncidentsPageProps = {
  searchParams: Promise<{ q?: string; page?: string; status?: string; siteId?: string; tab?: string }>;
};

export default async function ManagerIncidentsPage({ searchParams }: ManagerIncidentsPageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!["admin", "supervisor"].includes(session.user.role)) redirect("/forbidden");

  const params = await searchParams;
  const activeTab = params.tab === "sos" ? "sos" : "incidents";
  const statusFilter = (params.status ?? "").trim();
  const siteIdFilter = Number(params.siteId ?? "");
  const [incidentsRes, sosRes, sitesRes] = await Promise.all([
    backendApiWithSession<IncidentsResponse>(
      `/incidents${statusFilter && activeTab === "incidents" ? `?status=${encodeURIComponent(statusFilter)}` : ""}`,
      session
    ),
    backendApiWithSession<SosResponse>("/sos", session),
    backendApiWithSession<SiteList>("/sites?limit=200", session),
  ]);
  const allIncidents = incidentsRes.data?.items ?? [];
  const sites = sitesRes.data?.items ?? [];
  const loadErrors = [
    apiErrorMessage("Incidents", incidentsRes),
    apiErrorMessage("SOS events", sosRes),
    apiErrorMessage("Sites", sitesRes),
  ];
  const query = (params.q ?? "").trim();
  const filteredBySite = siteIdFilter
    ? allIncidents.filter((incident) => incident.siteId === siteIdFilter)
    : allIncidents;
  const filtered = filterByQuery(filteredBySite, query, (incident) =>
    [
      incident.title,
      incident.category,
      incident.siteName ?? "",
      incident.guardName ?? "",
      incident.userEmail ?? "",
      incident.userPhone ?? "",
    ].join(" ")
  );
  const PAGE_SIZE = 12;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const incidents = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const allSosEvents = sosRes.data?.items ?? [];
  let filteredSos = allSosEvents;
  if (statusFilter && activeTab === "sos") {
    filteredSos = filteredSos.filter((event) => event.status === statusFilter);
  }
  filteredSos = filterByQuery(filteredSos, query, (event) =>
    [
      String(event.id),
      event.guardName ?? "",
      event.userEmail ?? "",
      event.message ?? "",
      event.status,
      String(event.lat),
      String(event.lng),
    ].join(" ")
  );

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

  const filterQuery = `tab=incidents&q=${encodeURIComponent(query)}&status=${encodeURIComponent(statusFilter)}&siteId=${siteIdFilter || ""}`;
  const tabPreserved =
    activeTab === "incidents"
      ? {
          q: params.q,
          page: currentPage > 1 ? String(currentPage) : undefined,
          status: statusFilter || undefined,
          siteId: siteIdFilter ? String(siteIdFilter) : undefined,
        }
      : activeTab === "sos"
        ? {
            q: params.q,
            status: statusFilter || undefined,
          }
        : undefined;

  const headerDescription =
    activeTab === "sos"
      ? `${filteredSos.length} of ${allSosEvents.length} SOS event${allSosEvents.length === 1 ? "" : "s"}`
      : `${filtered.length} incident${filtered.length === 1 ? "" : "s"} · ${allSosEvents.length} SOS event${allSosEvents.length === 1 ? "" : "s"}`;

  return (
    <PortalPage>
      <PortalPageHeader title="Incidents & SOS" description={headerDescription}>
        <ApiErrorNotice errors={loadErrors} />
        <PortalTabNav
          basePath={BASE_PATH}
          tabs={[
            { id: "incidents", label: "Incidents" },
            { id: "sos", label: "SOS events" },
          ]}
          activeTab={activeTab}
          preserved={tabPreserved}
        />
        {activeTab === "incidents" ? (
          <PortalTableToolbar
            basePath={BASE_PATH}
            preserved={{ tab: "incidents" }}
            fields={[
              {
                type: "search",
                placeholder: "Search title, category, guard, site…",
                defaultValue: query,
              },
              {
                type: "select",
                name: "status",
                label: "Status",
                defaultValue: statusFilter,
                options: [
                  { value: "", label: "All statuses" },
                  { value: "open", label: "Open" },
                  { value: "in_review", label: "In review" },
                  { value: "closed", label: "Closed" },
                ],
              },
              {
                type: "select",
                name: "siteId",
                label: "Site",
                defaultValue: siteIdFilter ? String(siteIdFilter) : "",
                options: [
                  { value: "", label: "All sites" },
                  ...sites.map((site) => ({ value: String(site.id), label: site.name })),
                ],
              },
            ]}
          />
        ) : (
          <PortalTableToolbar
            basePath={BASE_PATH}
            preserved={{ tab: "sos" }}
            fields={[
              {
                type: "search",
                placeholder: "Search guard, message, location…",
                defaultValue: query,
              },
              {
                type: "select",
                name: "status",
                label: "Status",
                defaultValue: statusFilter,
                options: [
                  { value: "", label: "All statuses" },
                  { value: "active", label: "Active" },
                  { value: "acknowledged", label: "Acknowledged" },
                  { value: "resolved", label: "Resolved" },
                ],
              },
            ]}
          />
        )}
      </PortalPageHeader>

      <PortalPageTableBody>
        {activeTab === "incidents" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="lunar-table-wrap min-h-0 flex-1 overflow-auto rounded-none border-0 bg-transparent">
              <table className="portal-table min-w-[64rem]">
                <thead>
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide">ID</th>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide">Title</th>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide">Site</th>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide">Category</th>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide">Guard</th>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide">Status</th>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide">Reported</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-bold uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                        No incidents match your filters.
                      </td>
                    </tr>
                  ) : (
                    incidents.map((incident) => (
                      <tr key={incident.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-medium tabular-nums">#{incident.id}</td>
                        <td className="max-w-[12rem] px-4 py-3 font-medium text-slate-900">
                          <span className="line-clamp-2">{incident.title}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {incident.siteName ?? `Site ${incident.siteId}`}
                        </td>
                        <td className="px-4 py-3 capitalize text-slate-600">{incident.category}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">
                            {incident.guardName ?? incident.userEmail ?? "—"}
                          </p>
                          {incident.guardName && incident.userEmail ? (
                            <p className="text-xs text-slate-500">{incident.userEmail}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={incident.status} />
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatUkDateTime(incident.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <PortalModal
                            triggerLabel="View"
                            title={`Incident #${incident.id}`}
                            description={incident.title}
                            triggerClassName="lunar-btn-secondary lunar-btn-sm"
                            size="lg"
                          >
                            <DetailTable
                              rows={[
                                { label: "Title", value: incident.title },
                                { label: "Category", value: <span className="capitalize">{incident.category}</span> },
                                {
                                  label: "Site",
                                  value: incident.siteName ?? `Site #${incident.siteId}`,
                                },
                                {
                                  label: "Guard",
                                  value: (
                                    <div>
                                      <p className="font-medium">
                                        {incident.guardName ?? incident.userEmail ?? "—"}
                                      </p>
                                      {incident.guardName && incident.userEmail ? (
                                        <p className="text-xs text-slate-500">{incident.userEmail}</p>
                                      ) : null}
                                    </div>
                                  ),
                                },
                                {
                                  label: "Mobile",
                                  value: incident.userPhone?.trim() ? (
                                    <a
                                      href={`tel:${incident.userPhone.replace(/\s/g, "")}`}
                                      className="text-lunar-700 hover:underline"
                                    >
                                      {incident.userPhone}
                                    </a>
                                  ) : (
                                    "—"
                                  ),
                                },
                                { label: "Status", value: <StatusBadge status={incident.status} /> },
                                {
                                  label: "Reported",
                                  value: formatUkDateTime(incident.createdAt),
                                },
                              ]}
                            />
                            <form
                              action={updateIncidentStatusAction}
                              className="mt-5 space-y-3 border-t border-slate-100 pt-4"
                            >
                              <input type="hidden" name="id" value={String(incident.id)} />
                              <label className="block text-sm text-slate-600">
                                Update status
                                <select
                                  name="status"
                                  defaultValue={incident.status}
                                  className="mt-1 w-full lunar-select"
                                >
                                  <option value="open">Open</option>
                                  <option value="in_review">In review</option>
                                  <option value="closed">Closed</option>
                                </select>
                              </label>
                              <div className="flex flex-wrap gap-2">
                                <button type="submit" className="lunar-btn-primary">
                                  Save status
                                </button>
                                <PortalDetailLink
                                  href={`/manager/incidents/${incident.id}`}
                                  className="lunar-btn-secondary"
                                >
                                  Full record →
                                </PortalDetailLink>
                              </div>
                            </form>
                          </PortalModal>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-slate-500">
                Showing {incidents.length} of {filtered.length} incidents
              </p>
              <div className="flex items-center gap-2">
                <Link
                  href={`/manager/incidents?page=${Math.max(1, currentPage - 1)}&${filterQuery}`}
                  className={`lunar-btn-secondary lunar-btn-sm ${currentPage <= 1 ? "pointer-events-none opacity-40" : ""}`}
                >
                  Previous
                </Link>
                <span className="min-w-[7rem] text-center font-medium text-slate-600">
                  Page {currentPage} of {totalPages}
                </span>
                <Link
                  href={`/manager/incidents?page=${Math.min(totalPages, currentPage + 1)}&${filterQuery}`}
                  className={`lunar-btn-secondary lunar-btn-sm ${currentPage >= totalPages ? "pointer-events-none opacity-40" : ""}`}
                >
                  Next
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="lunar-table-wrap min-h-0 flex-1 overflow-auto rounded-none border-0 bg-transparent">
              <table className="portal-table min-w-[52rem]">
                <thead>
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide">ID</th>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide">Guard</th>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide">Location</th>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide">Message</th>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide">Status</th>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide">Reported</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-bold uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSos.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                        No SOS events match your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredSos.map((event) => (
                      <tr key={event.id} className="border-t border-rose-100/80 bg-rose-50/20 hover:bg-rose-50/40">
                        <td className="px-4 py-3 font-medium tabular-nums">#{event.id}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">
                            {event.guardName ?? event.userEmail ?? "—"}
                          </p>
                          {event.guardName && event.userEmail ? (
                            <p className="text-xs text-slate-500">{event.userEmail}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-700">
                          {event.lat}, {event.lng}
                        </td>
                        <td className="max-w-[14rem] px-4 py-3 text-slate-600">
                          <span className="line-clamp-2">{event.message?.trim() || "—"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={event.status} />
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatUkDateTime(event.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <PortalModal
                            triggerLabel="View"
                            title={`SOS #${event.id}`}
                            description="Emergency signal details"
                            triggerClassName="lunar-btn-secondary lunar-btn-sm"
                            size="md"
                          >
                            <DetailTable
                              rows={[
                                {
                                  label: "Guard",
                                  value: (
                                    <div>
                                      <p className="font-medium">
                                        {event.guardName ?? event.userEmail ?? "—"}
                                      </p>
                                      {event.guardName && event.userEmail ? (
                                        <p className="text-xs text-slate-500">{event.userEmail}</p>
                                      ) : null}
                                    </div>
                                  ),
                                },
                                {
                                  label: "Mobile",
                                  value: event.userPhone?.trim() ? (
                                    <a
                                      href={`tel:${event.userPhone.replace(/\s/g, "")}`}
                                      className="text-lunar-700 hover:underline"
                                    >
                                      {event.userPhone}
                                    </a>
                                  ) : (
                                    "—"
                                  ),
                                },
                                {
                                  label: "Latitude",
                                  value: event.lat,
                                },
                                {
                                  label: "Longitude",
                                  value: event.lng,
                                },
                                {
                                  label: "Message",
                                  value: event.message?.trim() || "—",
                                },
                                { label: "Status", value: <StatusBadge status={event.status} /> },
                                {
                                  label: "Reported",
                                  value: formatUkDateTime(event.createdAt),
                                },
                              ]}
                            />
                            <form
                              action={updateSosStatusAction}
                              className="mt-5 space-y-3 border-t border-slate-100 pt-4"
                            >
                              <input type="hidden" name="id" value={String(event.id)} />
                              <label className="block text-sm text-slate-600">
                                Update status
                                <select
                                  name="status"
                                  defaultValue={event.status}
                                  className="mt-1 w-full lunar-select"
                                >
                                  <option value="active">Active</option>
                                  <option value="acknowledged">Acknowledged</option>
                                  <option value="resolved">Resolved</option>
                                </select>
                              </label>
                              <button type="submit" className="lunar-btn-primary">
                                Save status
                              </button>
                            </form>
                          </PortalModal>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </PortalPageTableBody>
    </PortalPage>
  );
}
