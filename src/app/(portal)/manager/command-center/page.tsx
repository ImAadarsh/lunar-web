import { redirect } from "next/navigation";
import Link from "next/link";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { getSessionFromCookies } from "@/lib/server-session";
import { OperationsMap, type OpsMarker, type OpsTrail } from "@/components/operations/operations-map";
import { AutoRefreshControl } from "@/components/operations/auto-refresh-control";
import { CommandEventFeed } from "@/components/operations/command-event-feed";

type SiteList = {
  items: Array<{ id: number; name: string; centerLat: number; centerLng: number }>;
};

type ShiftList = {
  items: Array<{ id: number; siteId: number; userId: number; status: string; startsAt: string }>;
};

type IncidentList = {
  items: Array<{ id: number; siteId: number; title: string; status: string; createdAt: string }>;
};

type SosList = {
  items: Array<{
    id: number;
    userId: number;
    lat: number;
    lng: number;
    status: "active" | "acknowledged" | "resolved";
    createdAt: string;
  }>;
};
type CommandEventList = {
  items: Array<{
    id: number;
    type: string;
    actorUserId?: number | null;
    subjectUserId?: number | null;
    siteId?: number | null;
    entityType?: string | null;
    entityId?: string | null;
    payload?: unknown;
    createdAt: string;
  }>;
};
type KpiSummary = {
  onDutyGuards: number;
  openIncidents: number;
  activeSos: number;
  missedCheckpointsEstimate: number;
};
type TelemetryLatest = {
  items: Array<{
    userId: number;
    email: string;
    shiftId: number;
    siteId: number;
    lat: number;
    lng: number;
    accuracyM?: number;
    recordedAt: string;
  }>;
};
type TelemetryTrail = { items: Array<{ lat: number; lng: number; recordedAt: string }> };

type CommandCenterPageProps = {
  searchParams: Promise<{
    siteId?: string;
    shiftStatus?: string;
    incidentStatus?: string;
    sosStatus?: string;
    hours?: string;
  }>;
};

export default async function ManagerCommandCenterPage({ searchParams }: CommandCenterPageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!["admin", "supervisor"].includes(session.user.role)) redirect("/forbidden");
  const params = await searchParams;
  const siteId = Number(params.siteId ?? "");
  const shiftStatus = (params.shiftStatus ?? "active").trim();
  const incidentStatus = (params.incidentStatus ?? "open").trim();
  const sosStatus = (params.sosStatus ?? "active").trim();
  const hours = Math.max(1, Number(params.hours ?? "24") || 24);
  const cutoff = Date.now() - hours * 60 * 60 * 1000;

  const commandParams = new URLSearchParams({ limit: "30" });
  if (siteId) commandParams.set("siteId", String(siteId));
  const [sitesRes, shiftsRes, incidentsRes, sosRes, eventsRes, kpisRes, telemetryRes] = await Promise.all([
    backendApiWithSession<SiteList>("/sites", session),
    backendApiWithSession<ShiftList>(
      `/shifts${shiftStatus ? `?status=${encodeURIComponent(shiftStatus)}${siteId ? `&siteId=${siteId}` : ""}` : ""}`,
      session
    ),
    backendApiWithSession<IncidentList>(
      `/incidents${incidentStatus ? `?status=${encodeURIComponent(incidentStatus)}${siteId ? `&siteId=${siteId}` : ""}` : ""}`,
      session
    ),
    backendApiWithSession<SosList>("/sos", session),
    backendApiWithSession<CommandEventList>(`/command/events?${commandParams.toString()}`, session),
    backendApiWithSession<KpiSummary>("/dashboard/kpis", session),
    backendApiWithSession<TelemetryLatest>("/telemetry/latest", session),
  ]);

  const sites = sitesRes.data?.items ?? [];
  const siteMap = new Map(sites.map((site) => [site.id, site] as const));
  const activeShifts = (shiftsRes.data?.items ?? []).filter((shift) => {
    const inWindow = new Date(shift.startsAt).getTime() >= cutoff;
    return inWindow;
  });
  const openIncidents = (incidentsRes.data?.items ?? []).filter((incident) => {
    const inWindow = new Date(incident.createdAt).getTime() >= cutoff;
    return inWindow;
  });
  const sosEvents = (sosRes.data?.items ?? []).filter((event) => {
    const matchesStatus = sosStatus ? event.status === sosStatus : true;
    const inWindow = new Date(event.createdAt).getTime() >= cutoff;
    return matchesStatus && inWindow;
  });
  const telemetry = (telemetryRes.data?.items ?? []).filter((point) => {
    const matchesSite = siteId ? point.siteId === siteId : true;
    const inWindow = new Date(point.recordedAt).getTime() >= cutoff;
    return matchesSite && inWindow;
  });
  const primaryShiftId = telemetry[0]?.shiftId ?? activeShifts[0]?.id ?? null;
  const trailRes = primaryShiftId
    ? await backendApiWithSession<TelemetryTrail>(`/telemetry/trails?shiftId=${primaryShiftId}`, session)
    : null;
  const trails: OpsTrail[] = trailRes?.data?.items?.length
    ? [
        {
          id: `trail-${primaryShiftId}`,
          points: trailRes.data.items.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) })),
          color: "#7c3aed",
        },
      ]
    : [];
  const loadErrors = [
    apiErrorMessage("Sites", sitesRes),
    apiErrorMessage("Shifts", shiftsRes),
    apiErrorMessage("Incidents", incidentsRes),
    apiErrorMessage("SOS events", sosRes),
    apiErrorMessage("Command events", eventsRes),
    apiErrorMessage("Dashboard KPIs", kpisRes),
    apiErrorMessage("Live telemetry", telemetryRes),
    apiErrorMessage("Telemetry trail", trailRes),
  ];

  const markers: OpsMarker[] = [];
  for (const shift of activeShifts) {
    const site = siteMap.get(shift.siteId);
    if (!site) continue;
    markers.push({
      id: `shift-${shift.id}`,
      lat: Number(site.centerLat),
      lng: Number(site.centerLng),
      label: `Shift #${shift.id}`,
      type: "shift",
    });
  }
  for (const incident of openIncidents) {
    const site = siteMap.get(incident.siteId);
    if (!site) continue;
    markers.push({
      id: `incident-${incident.id}`,
      lat: Number(site.centerLat),
      lng: Number(site.centerLng),
      label: `Incident #${incident.id}`,
      type: "incident",
    });
  }
  for (const event of sosEvents) {
    markers.push({
      id: `sos-${event.id}`,
      lat: Number(event.lat),
      lng: Number(event.lng),
      label: `SOS #${event.id}`,
      type: "sos",
    });
  }
  for (const point of telemetry) {
    markers.push({
      id: `telemetry-${point.userId}`,
      lat: Number(point.lat),
      lng: Number(point.lng),
      label: `Guard ${point.userId}`,
      type: "telemetry",
    });
  }

  return (
    <div className="space-y-4">
      <ApiErrorNotice errors={loadErrors} />
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
          <AutoRefreshControl />
        </div>
        <form className="mt-3 grid gap-2 md:grid-cols-5">
          <select
            name="siteId"
            defaultValue={siteId ? String(siteId) : ""}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
          >
            <option value="">All sites</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
          <select
            name="shiftStatus"
            defaultValue={shiftStatus}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
          >
            <option value="active">active shifts</option>
            <option value="scheduled">scheduled shifts</option>
            <option value="completed">completed shifts</option>
            <option value="cancelled">cancelled shifts</option>
          </select>
          <select
            name="incidentStatus"
            defaultValue={incidentStatus}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
          >
            <option value="open">open incidents</option>
            <option value="in_review">in_review incidents</option>
            <option value="closed">closed incidents</option>
          </select>
          <select
            name="sosStatus"
            defaultValue={sosStatus}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
          >
            <option value="active">active SOS</option>
            <option value="acknowledged">acknowledged SOS</option>
            <option value="resolved">resolved SOS</option>
          </select>
          <select
            name="hours"
            defaultValue={String(hours)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
          >
            <option value="1">Last 1h</option>
            <option value="6">Last 6h</option>
            <option value="24">Last 24h</option>
            <option value="72">Last 72h</option>
            <option value="168">Last 7d</option>
          </select>
          <div className="md:col-span-5 flex items-center gap-2">
            <button className="rounded-md bg-lunar-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lunar-800">
              Apply filters
            </button>
            <Link
              href="/manager/command-center"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Reset
            </Link>
          </div>
        </form>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <Stat title="On-duty guards" value={kpisRes.data?.onDutyGuards ?? activeShifts.length} />
        <Stat title="Open incidents" value={kpisRes.data?.openIncidents ?? openIncidents.length} />
        <Stat title="Live SOS" value={kpisRes.data?.activeSos ?? sosEvents.length} />
        <Stat title="Missed checkpoints" value={kpisRes.data?.missedCheckpointsEstimate ?? 0} />
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Real-time command center map</h2>
        <p className="text-sm text-slate-500">
          Live guard telemetry, GPS trails, active shifts, open incidents, and SOS coordinates.
        </p>
        <div className="mt-4">
          <OperationsMap markers={markers} trails={trails} />
        </div>
      </section>

      <section className="grid gap-4 2xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-4 lg:grid-cols-4">
          <FeedCard title="Active shifts" items={activeShifts.map((s) => `Shift #${s.id} • Guard ${s.userId} • Site ${s.siteId}`)} />
          <FeedCard title="Open incidents" items={openIncidents.map((i) => `Incident #${i.id} • Site ${i.siteId} • ${i.title}`)} />
          <FeedCard title="SOS queue" items={sosEvents.map((e) => `SOS #${e.id} • Guard ${e.userId} • ${e.status}`)} />
          <FeedCard title="Live telemetry" items={telemetry.map((p) => `Guard ${p.userId} • Shift ${p.shiftId} • ${new Date(p.recordedAt).toLocaleTimeString()}`)} />
        </div>
        <CommandEventFeed initialEvents={eventsRes.data?.items ?? []} siteId={siteId || null} />
      </section>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-lunar-900">{value}</p>
    </div>
  );
}

function FeedCard({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No entries.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {items.map((item) => (
            <li key={item} className="rounded-lg border border-slate-100 p-2.5 text-slate-700">
              {item}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

