import { redirect } from "next/navigation";
import Link from "next/link";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { PortalPage, PortalPageBody, PortalPageHeader } from "@/components/portal/portal-page-layout";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { formatUkDateTime, formatUkTime } from "@/lib/format-datetime";
import { getSessionFromCookies } from "@/lib/server-session";
import { OperationsMap, type OpsMarker, type OpsTrail } from "@/components/operations/operations-map";
import { AutoRefreshControl } from "@/components/operations/auto-refresh-control";
import { CommandEventFeed } from "@/components/operations/command-event-feed";
import { CommandCenterFilters } from "@/components/operations/command-center-filters";
import { CommandOperationsFeedsTabs } from "@/components/operations/command-operations-feeds-tabs";

type SiteList = {
  items: Array<{ id: number; name: string; centerLat: number; centerLng: number }>;
};

type ShiftList = {
  items: Array<{
    id: number;
    siteId: number;
    userId: number;
    status: string;
    startsAt: string;
    endsAt: string;
    siteName?: string | null;
    userEmail?: string | null;
    guardName?: string | null;
    dutyState?: string | null;
  }>;
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
  const now = Date.now();
  const msWindow = hours * 60 * 60 * 1000;
  const upcomingShifts = shiftStatus === "scheduled";
  /** Incidents / SOS always use a look-back window. */
  const pastCutoff = now - msWindow;
  const shiftPeriodFrom = upcomingShifts ? new Date(now).toISOString() : new Date(pastCutoff).toISOString();
  const shiftPeriodTo = upcomingShifts ? new Date(now + msWindow).toISOString() : new Date(now).toISOString();

  const shiftQuery = new URLSearchParams({ from: shiftPeriodFrom, to: shiftPeriodTo });
  if (shiftStatus) shiftQuery.set("status", shiftStatus);
  if (siteId) shiftQuery.set("siteId", String(siteId));

  const incidentQuery = new URLSearchParams({ limit: "200" });
  if (incidentStatus) incidentQuery.set("status", incidentStatus);
  if (siteId) incidentQuery.set("siteId", String(siteId));

  const commandParams = new URLSearchParams({ limit: "30" });
  if (siteId) commandParams.set("siteId", String(siteId));

  const [sitesRes, shiftsRes, incidentsRes, sosRes, eventsRes, telemetryRes] = await Promise.all([
    backendApiWithSession<SiteList>("/sites", session),
    backendApiWithSession<ShiftList>(`/shifts?${shiftQuery.toString()}`, session),
    backendApiWithSession<IncidentList>(`/incidents?${incidentQuery.toString()}`, session),
    backendApiWithSession<SosList>("/sos", session),
    backendApiWithSession<CommandEventList>(`/command/events?${commandParams.toString()}`, session),
    backendApiWithSession<TelemetryLatest>("/telemetry/latest", session),
  ]);

  const sites = sitesRes.data?.items ?? [];
  const siteMap = new Map(sites.map((site) => [site.id, site] as const));
  const filteredShifts = shiftsRes.data?.items ?? [];
  const openIncidents = (incidentsRes.data?.items ?? []).filter((incident) => {
    const inWindow = new Date(incident.createdAt).getTime() >= pastCutoff;
    return inWindow;
  });
  const sosEvents = (sosRes.data?.items ?? []).filter((event) => {
    const matchesStatus = sosStatus ? event.status === sosStatus : true;
    const inWindow = new Date(event.createdAt).getTime() >= pastCutoff;
    return matchesStatus && inWindow;
  });
  const telemetryAll = (telemetryRes.data?.items ?? []).filter((point) => {
    const matchesSite = siteId ? point.siteId === siteId : true;
    const inWindow = new Date(point.recordedAt).getTime() >= pastCutoff;
    return matchesSite && inWindow;
  });
  const filteredShiftIds = new Set(filteredShifts.map((s) => s.id));
  const telemetry =
    shiftStatus === "active"
      ? telemetryAll
      : telemetryAll.filter((p) => filteredShiftIds.has(p.shiftId));
  const primaryShiftId = telemetry[0]?.shiftId ?? filteredShifts[0]?.id ?? null;
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
    apiErrorMessage("Live telemetry", telemetryRes),
    apiErrorMessage("Telemetry trail", trailRes),
  ];

  const shiftStatLabel = shiftStatusLabel(shiftStatus);
  const incidentStatLabel = incidentStatusLabel(incidentStatus);
  const sosStatLabel = sosStatusLabel(sosStatus);

  const markers: OpsMarker[] = [];
  for (const shift of filteredShifts) {
    const site = siteMap.get(shift.siteId);
    if (!site) continue;
    const guardLabel = shift.guardName?.trim() || shift.userEmail || `Guard ${shift.userId}`;
    const siteLabel = shift.siteName?.trim() || site.name;
    markers.push({
      id: `shift-${shift.id}`,
      lat: Number(site.centerLat),
      lng: Number(site.centerLng),
      label: String(shift.id),
      type: "shift",
      title: `Shift #${shift.id}`,
      details: [
        { label: "Status", value: shift.status },
        ...(shift.dutyState ? [{ label: "Duty", value: shift.dutyState.replace(/_/g, " ") }] : []),
        { label: "Site", value: siteLabel },
        { label: "Guard", value: guardLabel },
        { label: "Starts", value: formatUkDateTime(shift.startsAt) },
        { label: "Ends", value: formatUkDateTime(shift.endsAt) },
      ],
      actionHref: `/manager/guards/${shift.userId}`,
      actionLabel: "Open guard dashboard",
    });
  }
  for (const incident of openIncidents) {
    const site = siteMap.get(incident.siteId);
    if (!site) continue;
    markers.push({
      id: `incident-${incident.id}`,
      lat: Number(site.centerLat),
      lng: Number(site.centerLng),
      label: String(incident.id),
      type: "incident",
      title: incident.title,
      details: [
        { label: "Incident", value: `#${incident.id}` },
        { label: "Status", value: incident.status },
        { label: "Site", value: site.name },
        { label: "Reported", value: formatUkDateTime(incident.createdAt) },
      ],
      actionHref: `/manager/incidents/${incident.id}`,
      actionLabel: "Open incident",
    });
  }
  for (const event of sosEvents) {
    markers.push({
      id: `sos-${event.id}`,
      lat: Number(event.lat),
      lng: Number(event.lng),
      label: String(event.id),
      type: "sos",
      title: `SOS #${event.id}`,
      details: [
        { label: "Status", value: event.status },
        { label: "Guard", value: `User ${event.userId}` },
        { label: "Location", value: `${event.lat.toFixed(5)}, ${event.lng.toFixed(5)}` },
        { label: "Raised", value: formatUkDateTime(event.createdAt) },
      ],
      actionHref: "/manager/incidents",
      actionLabel: "Incidents & SOS",
    });
  }
  for (const point of telemetry) {
    const site = siteMap.get(point.siteId);
    markers.push({
      id: `telemetry-${point.userId}-${point.shiftId}`,
      lat: Number(point.lat),
      lng: Number(point.lng),
      label: String(point.userId),
      type: "telemetry",
      title: point.email || `Guard ${point.userId}`,
      details: [
        { label: "Shift", value: `#${point.shiftId}` },
        { label: "Site", value: site?.name ?? `Site ${point.siteId}` },
        ...(point.accuracyM != null ? [{ label: "GPS accuracy", value: `${Math.round(point.accuracyM)} m` }] : []),
        { label: "Recorded", value: formatUkTime(point.recordedAt) },
      ],
      actionHref: `/manager/guards/${point.userId}`,
      actionLabel: "Open guard dashboard",
    });
  }

  return (
    <PortalPage>
      <PortalPageHeader
        title="Command center"
        description="Live map, telemetry, and operational feeds across your sites."
        actions={<AutoRefreshControl />}
      >
        <ApiErrorNotice errors={loadErrors} />
        <CommandCenterFilters
          sites={sites}
          siteId={siteId || ""}
          shiftStatus={shiftStatus}
          incidentStatus={incidentStatus}
          sosStatus={sosStatus}
          hours={hours}
        />
      </PortalPageHeader>

      <PortalPageBody card={false} scrollPage className="pb-10">
        <div className="space-y-4">
          <section className="grid gap-3 md:grid-cols-4">
        <Stat title={shiftStatLabel} value={filteredShifts.length} />
        <Stat title={incidentStatLabel} value={openIncidents.length} />
        <Stat title={sosStatLabel} value={sosEvents.length} />
        <Stat title="Live telemetry" value={telemetry.length} />
      </section>

      <section className="lunar-card lunar-card-pad">
        <h2 className="text-lg font-semibold text-slate-900">Real-time command center map</h2>
        <p className="text-sm text-slate-500">
          Tap a marker for full details. Multiple shifts at the same site share one pin with a count (e.g. 2). Map clicks elsewhere only close the popup.
        </p>
        <div className="mt-4">
          <OperationsMap markers={markers} trails={trails} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <CommandOperationsFeedsTabs
          shiftsTabLabel={shiftStatLabel}
          shifts={filteredShifts.map((s) => {
            const guard = s.guardName?.trim() || s.userEmail || `Guard ${s.userId}`;
            const site = s.siteName?.trim() || `Site ${s.siteId}`;
            return `Shift #${s.id} · ${guard} · ${site} · ${formatUkDateTime(s.startsAt)} – ${formatUkDateTime(s.endsAt)}`;
          })}
          incidents={openIncidents.map((i) => {
            const site = siteMap.get(i.siteId)?.name ?? `Site ${i.siteId}`;
            return `Incident #${i.id} · ${site} · ${i.title} · ${formatUkDateTime(i.createdAt)}`;
          })}
          sos={sosEvents.map((e) => `SOS #${e.id} · Guard ${e.userId} · ${e.status} · ${formatUkDateTime(e.createdAt)}`)}
          telemetry={telemetry.map((p) => {
            const site = siteMap.get(p.siteId)?.name ?? `Site ${p.siteId}`;
            return `${p.email || `Guard ${p.userId}`} · ${site} · Shift ${p.shiftId} · ${formatUkTime(p.recordedAt)}`;
          })}
        />
        <CommandEventFeed initialEvents={eventsRes.data?.items ?? []} siteId={siteId || null} />
      </section>
        </div>
      </PortalPageBody>
    </PortalPage>
  );
}

function shiftStatusLabel(status: string): string {
  switch (status) {
    case "scheduled":
      return "Scheduled shifts";
    case "completed":
      return "Completed shifts";
    case "cancelled":
      return "Cancelled shifts";
    case "missed":
      return "Missed shifts";
    default:
      return "Active shifts";
  }
}

function incidentStatusLabel(status: string): string {
  switch (status) {
    case "in_review":
      return "In-review incidents";
    case "closed":
      return "Closed incidents";
    default:
      return "Open incidents";
  }
}

function sosStatusLabel(status: string): string {
  switch (status) {
    case "acknowledged":
      return "Acknowledged SOS";
    case "resolved":
      return "Resolved SOS";
    default:
      return "Active SOS";
  }
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-lunar-900">{value}</p>
    </div>
  );
}

