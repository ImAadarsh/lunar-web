/** Week roster helpers — shared by manual week form and CSV import. */

import { ukDateTimeLocalToIso, ukTodayDate } from "@/lib/uk-datetime";

export const WEEK_SCHEDULE_CSV_TEMPLATE = `date,start,end
2025-05-20,21:00,06:00
2025-05-21,13:00,18:00
2025-05-22,21:00,06:00`;

export type ParsedWeekShift = {
  startsAt: string;
  endsAt: string;
  dutyDate: string;
  dateLabel: string;
};

export type CsvParseResult =
  | { ok: true; shifts: ParsedWeekShift[] }
  | { ok: false; errors: string[] };

export function mondayOfWeekContaining(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return formatDateInput(d);
}

export function formatDutyDateLabel(dutyDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dutyDate)) return dutyDate;
  const [y, m, day] = dutyDate.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

/** Build ISO instants from a calendar date + UK wall-clock times (overnight rolls end to next day). */
export function buildShiftIso(dayDate: string, startTime: string, endTime: string) {
  const startNorm = startTime.length >= 5 ? startTime.slice(0, 5) : startTime;
  const endNorm = endTime.length >= 5 ? endTime.slice(0, 5) : endTime;
  const startsAt = ukDateTimeLocalToIso(`${dayDate}T${startNorm}`);
  let endsAt = ukDateTimeLocalToIso(`${dayDate}T${endNorm}`);
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    endsAt = ukDateTimeLocalToIso(`${addDays(dayDate, 1)}T${endNorm}`);
  }
  return { startsAt, endsAt, dutyDate: dayDate };
}

function normalizeTime(raw: string): string | null {
  const t = raw.trim();
  if (/^\d{1,2}:\d{2}$/.test(t)) {
    const [h, m] = t.split(":").map(Number);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(t)) return normalizeTime(t.slice(0, 5));
  return null;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if ((ch === "," || ch === ";") && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function isHeaderRow(cells: string[]) {
  const first = cells[0]?.toLowerCase() ?? "";
  return (
    first === "date" ||
    first === "day" ||
    first === "day_offset" ||
    first === "start" ||
    first === "start_time"
  );
}

/**
 * CSV columns: `date` (YYYY-MM-DD) or `day` (0–6 from week Monday), plus `start` and `end` times.
 * Optional header row. Lines starting with # are ignored.
 */
export function parseWeekScheduleCsv(text: string, weekStart?: string): CsvParseResult {
  const errors: string[] = [];
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (!lines.length) {
    return { ok: false, errors: ["CSV is empty"] };
  }

  let startIdx = 0;
  const firstCells = parseCsvLine(lines[0]);
  if (isHeaderRow(firstCells)) startIdx = 1;

  const shifts: ParsedWeekShift[] = [];

  for (let i = startIdx; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]);
    if (cells.length < 3) {
      errors.push(`Line ${i + 1}: need date (or day), start, and end`);
      continue;
    }

    const [colDate, colStart, colEnd] = cells;
    const start = normalizeTime(colStart);
    const end = normalizeTime(colEnd);
    if (!start || !end) {
      errors.push(`Line ${i + 1}: invalid start or end time (use HH:MM)`);
      continue;
    }

    let dayDate: string | null = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(colDate)) {
      dayDate = colDate;
    } else if (/^\d+$/.test(colDate) && weekStart) {
      const offset = Number(colDate);
      if (offset < 0 || offset > 6) {
        errors.push(`Line ${i + 1}: day offset must be 0–6`);
        continue;
      }
      dayDate = addDays(weekStart, offset);
    } else if (/^\d+$/.test(colDate) && !weekStart) {
      errors.push(`Line ${i + 1}: set “week starting” when using day offsets (0=Mon … 6=Sun)`);
      continue;
    } else {
      errors.push(`Line ${i + 1}: use YYYY-MM-DD or day offset 0–6`);
      continue;
    }

    const built = buildShiftIso(dayDate, start, end);
    shifts.push({
      startsAt: built.startsAt,
      endsAt: built.endsAt,
      dutyDate: built.dutyDate,
      dateLabel: formatDutyDateLabel(built.dutyDate),
    });
  }

  if (errors.length) return { ok: false, errors };
  if (!shifts.length) return { ok: false, errors: ["No shifts found in CSV"] };

  const seen = new Set<string>();
  for (const s of shifts) {
    if (seen.has(s.dutyDate)) {
      return {
        ok: false,
        errors: [`Duplicate duty day ${formatDutyDateLabel(s.dutyDate)} — one duty per day`],
      };
    }
    seen.add(s.dutyDate);
  }

  shifts.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return { ok: true, shifts };
}

export function downloadWeekScheduleTemplate() {
  const blob = new Blob([WEEK_SCHEDULE_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "week-roster-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}
