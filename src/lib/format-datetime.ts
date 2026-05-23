/** UK (Europe/London) date and time display for the portal. */

import { parseApiDateTime, UK_TIME_ZONE as UK_TZ } from "@/lib/uk-datetime";

export const UK_LOCALE = "en-GB";
export const UK_TIME_ZONE = UK_TZ;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function toDate(value: string | Date): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const v = value.trim();
  if (!v) return null;
  if (DATE_ONLY.test(v)) {
    const [y, m, d] = v.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  }
  return parseApiDateTime(v);
}

function hasTimeComponent(value: string) {
  return /T\d{2}:\d{2}/.test(value.trim());
}

/** Calendar date only — never shows time (pay periods, leave days, training dates, expiry). */
export function formatUkDateOnly(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const v = value.trim();
  const datePart = DATE_ONLY.test(v) ? v : v.slice(0, 10);
  if (DATE_ONLY.test(datePart)) return formatUkDate(datePart);
  return formatUkDate(v);
}

/** @alias formatUkDateOnly */
export const formatUkTrainedOn = formatUkDateOnly;

/** Inclusive calendar span — date only on both ends. */
export function formatUkDateRange(start: string, end: string): string {
  return `${formatUkDateOnly(start)} – ${formatUkDateOnly(end)}`;
}

/** Smart formatter: calendar dates vs datetimes from the API. */
export function formatUkFromApi(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const v = value.trim();
  if (DATE_ONLY.test(v)) return formatUkDateOnly(v);
  if (hasTimeComponent(v)) return formatUkDateTime(v);
  return formatUkDateOnly(v);
}

/** e.g. Sat, 18 Apr 2026, 7:30 pm BST */
export function formatUkDateTime(value: string | Date | null | undefined): string {
  const d = value == null ? null : typeof value === "string" ? toDate(value) : value;
  if (!d) return "—";
  return new Intl.DateTimeFormat(UK_LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: UK_TIME_ZONE,
    timeZoneName: "short",
  }).format(d);
}

/** e.g. 18 Apr 2026 */
export function formatUkDate(value: string | Date | null | undefined): string {
  const d = value == null ? null : typeof value === "string" ? toDate(value) : value;
  if (!d) return "—";
  return new Intl.DateTimeFormat(UK_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: UK_TIME_ZONE,
  }).format(d);
}

/** e.g. 7:30 pm */
export function formatUkTime(value: string | Date | null | undefined): string {
  const d = value == null ? null : typeof value === "string" ? toDate(value) : value;
  if (!d) return "—";
  return new Intl.DateTimeFormat(UK_LOCALE, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: UK_TIME_ZONE,
    timeZoneName: "short",
  }).format(d);
}

/** Shift / leave span: date or date-time per side. */
export function formatUkRange(start: string, end: string): string {
  const startHasTime = hasTimeComponent(start);
  const endHasTime = hasTimeComponent(end);
  if (startHasTime || endHasTime) {
    return `${formatUkDateTime(start)} – ${formatUkDateTime(end)}`;
  }
  return formatUkDateRange(start, end);
}

/** Current calendar month label in UK locale. */
export function formatUkMonthYear(date: Date = new Date()): string {
  return new Intl.DateTimeFormat(UK_LOCALE, {
    month: "long",
    year: "numeric",
    timeZone: UK_TIME_ZONE,
  }).format(date);
}
