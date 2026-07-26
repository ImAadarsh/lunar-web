"use client";

import { FilterDrawer } from "@/components/portal/filter-drawer";

type PeriodFilterDrawerProps = {
  basePath: string;
  year: number;
  month?: number;
  hiddenParams?: Record<string, string>;
  title?: string;
  description?: string;
};

const MONTHS = [
  { value: "", label: "All months" },
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

function periodSummary(year: number, month?: number) {
  if (!month) return String(year);
  const label = MONTHS.find((m) => m.value === String(month))?.label;
  return label ? `${label} ${year}` : String(year);
}

export function PeriodFilterDrawer({
  basePath,
  year,
  month,
  hiddenParams,
  title = "Period filters",
  description = "Choose the year and optional month to display.",
}: PeriodFilterDrawerProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  return (
    <FilterDrawer
      title={title}
      description={description}
      summary={periodSummary(year, month)}
      triggerLabel="Filters"
    >
      <form method="get" action={basePath} className="flex flex-col gap-4">
        {hiddenParams
          ? Object.entries(hiddenParams).map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))
          : null}
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">
          Year
          <select name="year" defaultValue={String(year)} className="lunar-input">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">
          Month
          <select name="month" defaultValue={month ? String(month) : ""} className="lunar-input">
            {MONTHS.map((m) => (
              <option key={m.value || "all"} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
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
