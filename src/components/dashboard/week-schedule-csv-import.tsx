"use client";

import { useMemo, useRef, useState } from "react";
import { ForceAssignField } from "@/components/dashboard/force-assign-field";
import { DutyScheduleHint } from "@/components/dashboard/duty-schedule-hint";
import { bulkScheduleShiftsAction } from "@/lib/shift-dashboard-actions";
import { formatUkDateTime } from "@/lib/format-datetime";
import {
  downloadWeekScheduleTemplate,
  formatDateInput,
  mondayOfWeekContaining,
  parseWeekScheduleCsv,
  WEEK_SCHEDULE_CSV_TEMPLATE,
  type ParsedWeekShift,
} from "@/lib/week-schedule";

type TrainedSiteOption = {
  siteId: number;
  siteName: string;
};

type WeekScheduleCsvImportProps = {
  userId: number;
  trainedSites: TrainedSiteOption[];
  isAdmin: boolean;
};

export function WeekScheduleCsvImport({ userId, trainedSites, isAdmin }: WeekScheduleCsvImportProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [weekStart, setWeekStart] = useState(() => formatDateInput(mondayOfWeekContaining(new Date())));
  const [siteId, setSiteId] = useState("");
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<ParsedWeekShift[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const parseResult = useMemo(() => {
    if (!csvText.trim()) return null;
    return parseWeekScheduleCsv(csvText, weekStart);
  }, [csvText, weekStart]);

  function applyParseToPreview() {
    if (!parseResult) return;
    if (!parseResult.ok) {
      setErrors(parseResult.errors);
      setPreview(null);
      return;
    }
    setErrors([]);
    setPreview(parseResult.shifts);
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    const result = parseWeekScheduleCsv(text, weekStart);
    if (!result.ok) {
      setErrors(result.errors);
      setPreview(null);
      return;
    }
    setErrors([]);
    setPreview(result.shifts);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!preview?.length || !siteId) return;
    const fd = new FormData(e.currentTarget);
    fd.set("userId", String(userId));
    fd.set("siteId", siteId);
    preview.forEach((row, i) => {
      fd.append(`shift_${i}_startsAt`, row.startsAt);
      fd.append(`shift_${i}_endsAt`, row.endsAt);
    });
    fd.set("shiftCount", String(preview.length));
    await bulkScheduleShiftsAction(fd);
  }

  if (trainedSites.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Train this guard on at least one site before importing a roster.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DutyScheduleHint />

      <label className="block text-sm text-slate-600">
        Week starting (Monday) — required when CSV uses day offsets 0–6
        <input
          type="date"
          className="mt-1 w-full lunar-input"
          value={weekStart}
          onChange={(e) => {
            setWeekStart(e.target.value);
            setPreview(null);
          }}
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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="lunar-btn-secondary lunar-btn-sm"
          onClick={() => downloadWeekScheduleTemplate()}
        >
          Download template
        </button>
        <button
          type="button"
          className="lunar-btn-secondary lunar-btn-sm"
          onClick={() => {
            setCsvText(WEEK_SCHEDULE_CSV_TEMPLATE);
            setErrors([]);
            setPreview(null);
          }}
        >
          Load example
        </button>
        <button
          type="button"
          className="lunar-btn-secondary lunar-btn-sm"
          onClick={() => fileRef.current?.click()}
        >
          Upload CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <label className="block text-sm text-slate-600">
        Or paste CSV
        <textarea
          className="mt-1 min-h-[120px] w-full lunar-input font-mono text-xs"
          value={csvText}
          placeholder={WEEK_SCHEDULE_CSV_TEMPLATE}
          onChange={(e) => {
            setCsvText(e.target.value);
            setPreview(null);
            setErrors([]);
          }}
        />
      </label>

      <p className="text-xs text-slate-600">
        Columns: <code className="rounded bg-slate-100 px-1">date</code> (YYYY-MM-DD) or{" "}
        <code className="rounded bg-slate-100 px-1">day</code> (0=Mon … 6=Sun),{" "}
        <code className="rounded bg-slate-100 px-1">start</code>, <code className="rounded bg-slate-100 px-1">end</code>
        . Overnight end before start rolls to the next calendar day.
      </p>

      <button type="button" className="lunar-btn-secondary lunar-btn-sm" onClick={applyParseToPreview}>
        Preview import
      </button>

      {errors.length > 0 ? (
        <ul className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}

      {preview && preview.length > 0 ? (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <table className="portal-table w-full text-sm">
            <thead>
              <tr>
                <th>Duty day</th>
                <th>Start</th>
                <th>End</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row) => (
                <tr key={row.dutyDate}>
                  <td className="font-medium">{row.dateLabel}</td>
                  <td className="tabular-nums">{formatUkDateTime(row.startsAt)}</td>
                  <td className="tabular-nums">{formatUkDateTime(row.endsAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <ForceAssignField isAdmin={isAdmin} />

      <button
        type="submit"
        className="lunar-btn-primary w-full sm:w-auto"
        disabled={!siteId || !preview?.length}
      >
        Import {preview?.length ?? 0} {preview?.length === 1 ? "shift" : "shifts"}
      </button>
    </form>
  );
}
