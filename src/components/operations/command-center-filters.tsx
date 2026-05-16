"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

  return (
    <form method="get" className="grid gap-2 md:grid-cols-5">
      <select name="siteId" defaultValue={siteId ? String(siteId) : ""} className="lunar-input">
        <option value="">All sites</option>
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </select>
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
      <select name="incidentStatus" defaultValue={incidentStatus} className="lunar-input">
        <option value="open">open incidents</option>
        <option value="in_review">in_review incidents</option>
        <option value="closed">closed incidents</option>
      </select>
      <select name="sosStatus" defaultValue={sosStatus} className="lunar-input">
        <option value="active">active SOS</option>
        <option value="acknowledged">acknowledged SOS</option>
        <option value="resolved">resolved SOS</option>
      </select>
      <select name="hours" defaultValue={String(hours)} className="lunar-input" aria-label={upcomingShifts ? "Upcoming time window" : "Past time window"}>
        {timeOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <p className="md:col-span-5 text-xs text-[var(--portal-text-muted)]">
        {upcomingShifts
          ? "Scheduled shifts: time window looks ahead from now (upcoming)."
          : "Shifts use a look-back window; incidents and SOS always use the past window."}
      </p>
      <div className="md:col-span-5 flex items-center gap-2">
        <button type="submit" className="rounded-md bg-lunar-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lunar-800">
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
  );
}

function formatWindowLabel(hours: number): string {
  if (hours === 168) return "7d";
  return `${hours}h`;
}
