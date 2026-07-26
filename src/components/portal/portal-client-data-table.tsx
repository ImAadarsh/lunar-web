"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  PortalBulkActionBar,
  PortalRowCheckbox,
  PortalSelectAllCheckbox,
  type PortalBulkAction,
} from "@/components/portal/portal-table-selection";
import type { PortalDataTableColumn } from "@/components/portal/portal-data-table";
import { PortalPageSizeSelect } from "@/components/portal/portal-page-size-select";
import {
  compareOptionalDates,
  compareStrings,
  DEFAULT_PORTAL_PAGE_SIZE,
  parsePortalPageSize,
  type SortDirection,
} from "@/lib/portal-table";

export type PortalClientColumn<T> = PortalDataTableColumn<T> & {
  sortValue?: (row: T) => string | number;
};

type PortalClientDataTableProps<T> = {
  columns: PortalClientColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  emptyMessage: string;
  searchPlaceholder?: string;
  searchText?: (row: T) => string;
  defaultSort?: string;
  defaultDir?: SortDirection;
  minWidth?: string;
  /** Fallback when `pageSize` is absent from the URL. */
  defaultPageSize?: number;
  bulk?: {
    formId: string;
    action: (formData: FormData) => void | Promise<void>;
    actions: PortalBulkAction[];
    getRowId: (row: T) => number;
    /** Only rows matching this can be selected */
    canSelect?: (row: T) => boolean;
  };
  className?: string;
};

function sortRows<T>(rows: T[], columns: PortalClientColumn<T>[], sort: string, dir: SortDirection) {
  const col = columns.find((c) => c.id === sort);
  if (!col?.sortable) return rows;
  const copy = [...rows];
  copy.sort((a, b) => {
    const av = col.sortValue ? col.sortValue(a) : String(col.render(a) ?? "");
    const bv = col.sortValue ? col.sortValue(b) : String(col.render(b) ?? "");
    if (typeof av === "number" && typeof bv === "number") {
      return dir === "asc" ? av - bv : bv - av;
    }
    const as = String(av);
    const bs = String(bv);
    if (/^\d{4}-\d{2}-\d{2}/.test(as) && /^\d{4}-\d{2}-\d{2}/.test(bs)) {
      return compareOptionalDates(as, bs, dir);
    }
    return compareStrings(as, bs, dir);
  });
  return copy;
}

export function PortalClientDataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage,
  searchPlaceholder = "Search…",
  searchText,
  defaultSort,
  defaultDir = "asc",
  minWidth = "32rem",
  defaultPageSize = DEFAULT_PORTAL_PAGE_SIZE,
  bulk,
  className,
}: PortalClientDataTableProps<T>) {
  const searchParams = useSearchParams();
  const pageSize = parsePortalPageSize(searchParams.get("pageSize"), parsePortalPageSize(defaultPageSize));

  const [q, setQ] = useState("");
  const [sort, setSort] = useState(defaultSort ?? columns.find((c) => c.sortable)?.id ?? columns[0]?.id ?? "");
  const [dir, setDir] = useState<SortDirection>(defaultDir);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!searchText || !q.trim()) return rows;
    const needle = q.trim().toLowerCase();
    return rows.filter((row) => searchText(row).toLowerCase().includes(needle));
  }, [rows, q, searchText]);

  const sorted = useMemo(() => sortRows(filtered, columns, sort, dir), [filtered, columns, sort, dir]);

  const totalCount = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const rangeStart = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalCount);

  function toggleSort(columnId: string) {
    if (sort === columnId) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(columnId);
      setDir("asc");
    }
    setPage(1);
  }

  const table = (
    <table className="portal-table" style={{ minWidth }}>
      <thead>
        <tr>
          {bulk ? (
            <th className="w-10 px-3">
              <PortalSelectAllCheckbox formId={bulk.formId} />
            </th>
          ) : null}
          {columns.map((col) => (
            <th key={col.id} className={col.headerClassName}>
              {col.sortable ? (
                <button
                  type="button"
                  onClick={() => toggleSort(col.id)}
                  className="inline-flex items-center hover:text-[var(--portal-accent)]"
                >
                  {col.label}
                  <span className="ml-1 text-[0.65rem] opacity-60">
                    {sort === col.id ? (dir === "asc" ? "▲" : "▼") : "↕"}
                  </span>
                </button>
              ) : (
                col.label
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {pageRows.length === 0 ? (
          <tr>
            <td colSpan={columns.length + (bulk ? 1 : 0)} className="text-center text-[var(--portal-text-muted)]">
              {emptyMessage}
            </td>
          </tr>
        ) : (
          pageRows.map((row) => (
            <tr key={rowKey(row)}>
              {bulk ? (
                <td className="w-10 px-3">
                  {bulk.canSelect && !bulk.canSelect(row) ? (
                    <span className="inline-block w-4" aria-hidden />
                  ) : (
                    <PortalRowCheckbox formId={bulk.formId} value={bulk.getRowId(row)} />
                  )}
                </td>
              ) : null}
              {columns.map((col) => (
                <td key={col.id} className={col.cellClassName}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {searchText ? (
        <div className="shrink-0 border-b border-[var(--portal-border)] px-3 py-2">
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
            className="w-full lunar-input-sm"
          />
        </div>
      ) : null}

      {bulk ? (
        <form id={bulk.formId} action={bulk.action} className="shrink-0">
          {bulk.actions.length > 0 ? (
            <div className="border-b border-[var(--portal-border)] px-3 py-2">
              <PortalBulkActionBar formId={bulk.formId} actions={bulk.actions} />
            </div>
          ) : null}
        </form>
      ) : null}
      <div className="lunar-table-wrap min-h-0 flex-1">{table}</div>

      <div className="flex shrink-0 flex-col gap-3 border-t border-[var(--portal-border)] px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[var(--portal-text-muted)]">
            {totalCount === 0 ? "No rows" : `${rangeStart}–${rangeEnd} of ${totalCount}`}
          </p>
          <PortalPageSizeSelect pageSize={pageSize} onPageSizeChange={() => setPage(1)} />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="lunar-btn-secondary lunar-btn-sm"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <span className="min-w-[5rem] self-center text-center text-sm font-medium text-[var(--portal-text)]">
            {currentPage}/{totalPages}
          </span>
          <button
            type="button"
            className="lunar-btn-secondary lunar-btn-sm"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
