import type { GuardAvailabilityInfo, GuardAvailabilityState } from "@/lib/guard-availability";
import { mapApiAvailability } from "@/lib/guard-availability";

export type BackendAvailability = {
  state: GuardAvailabilityState;
  dutyState?: string | null;
  canAssign?: boolean;
  rechargingUntil: string | Date | null;
  lastShiftEndedAt: string | Date | null;
};

export function mapBackendAvailability(availability: BackendAvailability): GuardAvailabilityInfo {
  return mapApiAvailability(availability);
}

export type HoursDayRow = {
  workDate: string;
  hours: number | string;
  sessionCount: number | string;
};

export type HoursMonthRow = {
  year: number;
  month: number;
  hours: number | string;
  sessionCount: number | string;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function formatHours(value: number | string) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(2)} h` : "—";
}

export function formatWorkDateLabel(workDate: string) {
  const raw = String(workDate).slice(0, 10);
  const d = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(d);
}

export function formatMonthLabel(year: number, month: number) {
  return `${MONTH_NAMES[month - 1] ?? month} ${year}`;
}
