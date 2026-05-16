import Link from "next/link";
import {
  buildPortalTableHref,
  nextSortDirection,
  type PortalTableParams,
  type SortDirection,
} from "@/lib/portal-table";
import { cn } from "@/lib/cn";
import {
  PortalBulkActionBar,
  PortalRowCheckbox,
  PortalSelectAllCheckbox,
  type PortalBulkAction,
} from "@/components/portal/portal-table-selection";

export type PortalDataTableColumn<T> = {
  id: string;
  label: string;
  sortable?: boolean;
  headerClassName?: string;
  cellClassName?: string;
  render: (row: T) => React.ReactNode;
};

type PortalDataTableProps<T> = {
  basePath: string;
  query: PortalTableParams & Record<string, string | undefined>;
  columns: PortalDataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  emptyMessage: string;
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  sort: string;
  dir: SortDirection;
  /** Enable row checkboxes + bulk action bar (checkboxes associate via form attribute). */
  bulk?: {
    formId: string;
    action: (formData: FormData) => void | Promise<void>;
    actions: PortalBulkAction[];
    getRowId: (row: T) => number;
  };
  minWidth?: string;
};

function SortIcon({ active, dir }: { active: boolean; dir: SortDirection }) {
  return (
    <span
      className={cn(
        "ml-1 inline-block text-[0.65rem]",
        active ? "text-[var(--portal-accent)]" : "text-[var(--portal-text-muted)] opacity-60",
      )}
    >
      {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
    </span>
  );
}

export function PortalDataTable<T>({
  basePath,
  query,
  columns,
  rows,
  rowKey,
  emptyMessage,
  page,
  totalPages,
  totalCount,
  pageSize,
  sort,
  dir,
  bulk,
  minWidth = "44rem",
}: PortalDataTableProps<T>) {
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);

  const preserved: PortalTableParams & Record<string, string | undefined> = { ...query };

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
                <Link
                  href={buildPortalTableHref(basePath, {
                    ...preserved,
                    sort: col.id,
                    dir: nextSortDirection(sort, col.id, dir),
                    page: 1,
                  })}
                  className="inline-flex items-center hover:text-[var(--portal-accent)]"
                >
                  {col.label}
                  <SortIcon active={sort === col.id} dir={dir} />
                </Link>
              ) : (
                col.label
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length + (bulk ? 1 : 0)} className="text-center text-[var(--portal-text-muted)]">
              {emptyMessage}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={rowKey(row)}>
              {bulk ? (
                <td className="w-10 px-3">
                  <PortalRowCheckbox formId={bulk.formId} value={bulk.getRowId(row)} />
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
    <div className="flex min-h-0 flex-1 flex-col">
      {bulk ? (
        <form id={bulk.formId} action={bulk.action} className="shrink-0">
          {bulk.actions.length > 0 ? (
            <div className="border-b border-[var(--portal-border)] px-4 py-2">
              <PortalBulkActionBar formId={bulk.formId} actions={bulk.actions} />
            </div>
          ) : null}
        </form>
      ) : null}
      <div className="lunar-table-wrap min-h-0 flex-1">{table}</div>

      <div className="flex shrink-0 flex-col gap-3 border-t border-[var(--portal-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--portal-text-muted)]">
          {totalCount === 0 ? "No rows" : `Showing ${rangeStart}–${rangeEnd} of ${totalCount}`}
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={buildPortalTableHref(basePath, { ...preserved, sort, dir, page: Math.max(1, page - 1) })}
            className={cn("lunar-btn-secondary lunar-btn-sm", page <= 1 && "pointer-events-none opacity-40")}
            aria-disabled={page <= 1}
          >
            Previous
          </Link>
          <span className="min-w-[7rem] text-center text-sm font-medium text-[var(--portal-text)]">
            Page {page} of {totalPages}
          </span>
          <Link
            href={buildPortalTableHref(basePath, {
              ...preserved,
              sort,
              dir,
              page: Math.min(totalPages, page + 1),
            })}
            className={cn(
              "lunar-btn-secondary lunar-btn-sm",
              page >= totalPages && "pointer-events-none opacity-40",
            )}
            aria-disabled={page >= totalPages}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
