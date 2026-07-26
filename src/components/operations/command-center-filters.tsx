"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { FilterDrawer } from "@/components/portal/filter-drawer";

type SiteOption = { id: number; name: string };

type CommandCenterFiltersProps = {
  sites: SiteOption[];
  siteId: number | "";
  shiftStatus: string;
  incidentStatus: string;
  sosStatus: string;
  hours: number;
};

const HOUR_OPTIONS = [
  { value: "1", hours: 1 },
  { value: "6", hours: 6 },
  { value: "24", hours: 24 },
  { value: "72", hours: 72 },
  { value: "168", hours: 168 },
] as const;

export function CommandCenterFilters({
  sites,
  siteId,
  shiftStatus: initialShiftStatus,
  incidentStatus,
  sosStatus,
  hours,
}: CommandCenterFiltersProps) {
  const [shiftStatus, setShiftStatus] = useState(initialShiftStatus);
  useEffect(() => {
    setShiftStatus(initialShiftStatus);
  }, [initialShiftStatus]);
  const upcomingShifts = shiftStatus === "scheduled";

  const timeOptions = useMemo(
    () =>
      HOUR_OPTIONS.map((opt) => ({
        value: opt.value,
        label: upcomingShifts ? `Next ${formatWindowLabel(opt.hours)}` : `Last ${formatWindowLabel(opt.hours)}`,
      })),
    [upcomingShifts],
  );

  const siteName = siteId ? sites.find((s) => s.id === siteId)?.name : null;
  const windowLabel = upcomingShifts ? `Next ${formatWindowLabel(hours)}` : `Last ${formatWindowLabel(hours)}`;
  const summary =
    [siteName, shiftStatus || null, incidentStatus || null, sosStatus || null, windowLabel]
      .filter(Boolean)
      .join(" · ") || undefined;

  return (
    <FilterDrawer
      title="Command center filters"
      description="Narrow the map and feeds by site, status, and time window."
      summary={summary}
      triggerLabel="Filters"
    >
      <form method="get" className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">
          Site
          <SearchableSelect
            name="siteId"
            defaultValue={siteId ? String(siteId) : ""}
            emptyLabel="All sites"
            searchPlaceholder="Search sites…"
            placeholder="Site"
            options={sites.map((site) => ({ value: String(site.id), label: site.name }))}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">
          Shifts
          <select
            name="shiftStatus"
            value={shiftStatus}
            onChange={(e) => setShiftStatus(e.target.value)}
            className="lunar-input"
          >
            <option value="active">active shifts</option>
            <option value="scheduled">scheduled shifts</option>
            <option value="completed">completed shifts</option>
            <option value="cancelled">cancelled shifts</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">
          Incidents
          <select name="incidentStatus" defaultValue={incidentStatus} className="lunar-input">
            <option value="open">open incidents</option>
            <option value="in_review">in_review incidents</option>
            <option value="closed">closed incidents</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">
          SOS
          <select name="sosStatus" defaultValue={sosStatus} className="lunar-input">
            <option value="active">active SOS</option>
            <option value="acknowledged">acknowledged SOS</option>
            <option value="resolved">resolved SOS</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">
          Time window
          <select
            name="hours"
            defaultValue={String(hours)}
            className="lunar-input"
            aria-label={upcomingShifts ? "Upcoming time window" : "Past time window"}
          >
            {timeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-[var(--portal-text-muted)]">
          {upcomingShifts
            ? "Scheduled shifts: time window looks ahead from now (upcoming)."
            : "Shifts use a look-back window; incidents and SOS always use the past window."}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 border-t border-[var(--portal-border)] pt-4">
          <button type="submit" className="lunar-btn-primary">
            Apply
          </button>
          <Link href="/manager/command-center" className="lunar-btn-secondary">
            Reset
          </Link>
        </div>
      </form>
    </FilterDrawer>
  );
}

function formatWindowLabel(hours: number): string {
  if (hours === 168) return "7d";
  return `${hours}h`;
}
