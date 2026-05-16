export type SortDirection = "asc" | "desc";

export type PortalTableParams = {
  q?: string;
  page?: string | number;
  sort?: string;
  dir?: string;
  siteId?: string;
  userId?: string;
  status?: string;
  role?: string;
  tab?: string;
};

export function buildPortalTableHref(
  basePath: string,
  params: PortalTableParams & Record<string, string | number | undefined>
) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function nextSortDirection(
  currentSort: string,
  column: string,
  currentDir: SortDirection
): SortDirection {
  if (currentSort !== column) return "asc";
  return currentDir === "asc" ? "desc" : "asc";
}

export function compareStrings(a: string, b: string, dir: SortDirection) {
  const result = a.localeCompare(b, undefined, { sensitivity: "base" });
  return dir === "asc" ? result : -result;
}

export function compareNumbers(a: number, b: number, dir: SortDirection) {
  if (a === b) return 0;
  return dir === "asc" ? a - b : b - a;
}

export function compareOptionalDates(
  a: string | null | undefined,
  b: string | null | undefined,
  dir: SortDirection
) {
  const aTime = a ? new Date(a).getTime() : 0;
  const bTime = b ? new Date(b).getTime() : 0;
  if (aTime === bTime) return 0;
  if (!aTime) return dir === "asc" ? 1 : -1;
  if (!bTime) return dir === "asc" ? -1 : 1;
  return dir === "asc" ? aTime - bTime : bTime - aTime;
}

export function parseSortDir(dir: string | undefined): SortDirection {
  return dir === "desc" ? "desc" : "asc";
}

export function parseTablePage(page: string | undefined, totalPages: number) {
  const n = Math.max(1, Number(page ?? "1") || 1);
  return Math.min(n, Math.max(1, totalPages));
}

export function filterByQuery<T>(
  rows: T[],
  q: string,
  toSearchable: (row: T) => string
) {
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => toSearchable(row).toLowerCase().includes(needle));
}

export function paginateRows<T>(rows: T[], page: number, pageSize: number) {
  const totalCount = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = parseTablePage(String(page), totalPages);
  const slice = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return { slice, totalCount, totalPages, currentPage };
}

export function parseBulkIds(formData: FormData, field = "ids") {
  return formData
    .getAll(field)
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);
}
