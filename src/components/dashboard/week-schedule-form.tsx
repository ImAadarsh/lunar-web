"use client";

import { useMemo, useState } from "react";
import { ForceAssignField } from "@/components/dashboard/force-assign-field";
import { DutyScheduleHint } from "@/components/dashboard/duty-schedule-hint";
import { bulkScheduleShiftsAction } from "@/lib/shift-dashboard-actions";
import {
  addDays,
  buildShiftIso,
  formatDateInput,
  formatDutyDateLabel,
  mondayOfWeekContaining,
} from "@/lib/week-schedule";

type TrainedSiteOption = {
  siteId: number;
  siteName: string;
};

type WeekScheduleFormProps = {
  userId: number;
  trainedSites: TrainedSiteOption[];
  isAdmin: boolean;
};

type DayRow = {
  enabled: boolean;
  startTime: string;
  endTime: string;
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const defaultRow = (): DayRow => ({
  enabled: false,
  startTime: "21:00",
  endTime: "06:00",
});

export function WeekScheduleForm({ userId, trainedSites, isAdmin }: WeekScheduleFormProps) {
  const [weekStart, setWeekStart] = useState(() => formatDateInput(mondayOfWeekContaining(new Date())));
  const [siteId, setSiteId] = useState<string>("");
  const [days, setDays] = useState<DayRow[]>(() => Array.from({ length: 7 }, defaultRow));

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  if (trainedSites.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Train this guard on at least one site before scheduling a week.
      </p>
    );
  }

  function updateDay(index: number, patch: Partial<DayRow>) {
    setDays((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("userId", String(userId));
    fd.set("siteId", siteId);
    fd.set("weekStart", weekStart);
    let n = 0;
    days.forEach((row, i) => {
      if (!row.enabled) return;
      const { startsAt, endsAt } = buildShiftIso(weekDates[i], row.startTime, row.endTime);
      fd.append(`shift_${n}_startsAt`, startsAt);
      fd.append(`shift_${n}_endsAt`, endsAt);
      n += 1;
    });
    fd.set("shiftCount", String(n));
    await bulkScheduleShiftsAction(fd);
  }

  const enabledCount = days.filter((d) => d.enabled).length;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="userId" value={userId} />
      <DutyScheduleHint />

      <label className="block text-sm text-slate-600">
        Week starting (Monday)
        <input
          name="weekStart"
          type="date"
          required
          className="mt-1 w-full lunar-input"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
        />
      </label>

      <label className="block text-sm text-slate-600">
        Site
        <select
          name="siteId"
          required
          className="mt-1 w-full lunar-select"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
        >
          <option value="" disabled>
            Select trained site
          </option>
          {trainedSites.map((site) => (
            <option key={site.siteId} value={site.siteId}>
              {site.siteName}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-800">Days (tick to assign one duty that day)</p>
        <ul className="space-y-2">
          {days.map((row, i) => (
            <li
              key={weekDates[i]}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2"
            >
              <label className="flex min-w-[7rem] items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(e) => updateDay(i, { enabled: e.target.checked })}
                />
                {WEEKDAY_LABELS[i]} {formatDutyDateLabel(weekDates[i])}
              </label>
              <input
                type="time"
                className="lunar-input w-[7rem] text-sm"
                value={row.startTime}
                disabled={!row.enabled}
                onChange={(e) => updateDay(i, { startTime: e.target.value })}
              />
              <span className="text-xs text-slate-500">to</span>
              <input
                type="time"
                className="lunar-input w-[7rem] text-sm"
                value={row.endTime}
                disabled={!row.enabled}
                onChange={(e) => updateDay(i, { endTime: e.target.value })}
              />
            </li>
          ))}
        </ul>
      </div>

      <ForceAssignField isAdmin={isAdmin} />

      <button
        type="submit"
        className="lunar-btn-primary w-full sm:w-auto"
        disabled={!siteId || enabledCount === 0}
      >
        Save week ({enabledCount} {enabledCount === 1 ? "shift" : "shifts"})
      </button>
    </form>
  );
}
