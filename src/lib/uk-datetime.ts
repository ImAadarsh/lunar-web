/**
 * UK (Europe/London) wall-clock ↔ UTC instants.
 * All shift scheduling and datetime-local inputs use UK time (GMT/BST).
 */

export const UK_TIME_ZONE = "Europe/London";

type WallParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function parseWallString(value: string): WallParts | null {
  const v = value.trim().replace(" ", "T");
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4] ?? 0),
    minute: Number(m[5] ?? 0),
    second: Number(m[6] ?? 0),
  };
}

/** UK calendar parts for a UTC instant. */
export function getUkParts(utcMs: number): WallParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(utcMs));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function wallPartsToPseudoUtcMs(p: WallParts): number {
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

/** UK wall clock → UTC epoch ms. */
export function ukWallClockToUtcMs(wall: WallParts): number {
  let utc = wallPartsToPseudoUtcMs(wall);
  for (let i = 0; i < 4; i += 1) {
    const uk = getUkParts(utc);
    const diff = wallPartsToPseudoUtcMs(wall) - wallPartsToPseudoUtcMs(uk);
    if (diff === 0) break;
    utc += diff;
  }
  return utc;
}

/** `datetime-local` value or `YYYY-MM-DD HH:mm:ss` interpreted as UK → ISO UTC for the API. */
export function ukDateTimeLocalToIso(naive: string): string {
  const v = naive.trim();
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? naive : d.toISOString();
  }
  const wall = parseWallString(v);
  if (!wall) return naive;
  return new Date(ukWallClockToUtcMs(wall)).toISOString();
}

/** API / DB value → `datetime-local` string in UK (YYYY-MM-DDTHH:mm). */
export function isoToUkDateTimeLocal(iso: string | Date): string {
  const ms = typeof iso === "string" ? parseApiDateTime(iso)?.getTime() ?? NaN : iso.getTime();
  if (Number.isNaN(ms)) return "";
  const p = getUkParts(ms);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`;
}

/**
 * Parse API / MySQL datetimes: ISO with offset, or naive UK wall clock.
 */
export function parseApiDateTime(value: string): Date | null {
  const v = value.trim();
  if (!v) return null;
  if (/Z$|[+-]\d{2}:\d{2}$/.test(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const wall = parseWallString(v);
  if (!wall) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(ukWallClockToUtcMs(wall));
}

/** Today as YYYY-MM-DD in UK. */
export function ukTodayDate(): string {
  const p = getUkParts(Date.now());
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** Inclusive date-only range → ISO bounds for shift API filters. */
export function ukDateRangeToIsoBounds(from: string, to: string): { from: string; to: string } {
  return {
    from: ukDateTimeLocalToIso(`${from}T00:00:00`),
    to: ukDateTimeLocalToIso(`${to}T23:59:59`),
  };
}

/** MySQL-style UK wall clock for server-side filters (matches stored shift times). */
export function ukDateTimeToMysql(value: string): string {
  const iso = ukDateTimeLocalToIso(value.includes("T") ? value : value.replace(" ", "T"));
  const p = getUkParts(new Date(iso).getTime());
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}`;
}
