"use client";

import { FilterDrawer } from "@/components/portal/filter-drawer";
import { formatUkDateRange } from "@/lib/format-datetime";

type DateRangeFilterDrawerProps = {
  basePath: string;
  from: string;
  to: string;
  hiddenParams?: Record<string, string>;
  title?: string;
  description?: string;
};

export function DateRangeFilterDrawer({
  basePath,
  from,
  to,
  hiddenParams,
  title = "Date range",
  description = "Choose the period shown on the mega calendar.",
}: DateRangeFilterDrawerProps) {
  return (
    <FilterDrawer title={title} description={description} summary={formatUkDateRange(from, to)} triggerLabel="Filters">
      <form method="get" action={basePath} className="flex flex-col gap-4">
        {hiddenParams
          ? Object.entries(hiddenParams).map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))
          : null}
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">
          From
          <input name="from" type="date" defaultValue={from} required className="lunar-input" />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">
          To
          <input name="to" type="date" defaultValue={to} required className="lunar-input" />
        </label>
        <div className="mt-2 flex flex-wrap gap-2 border-t border-[var(--portal-border)] pt-4">
          <button type="submit" className="lunar-btn-primary">
            Apply
          </button>
        </div>
      </form>
    </FilterDrawer>
  );
}
