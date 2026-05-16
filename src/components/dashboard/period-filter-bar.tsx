type PeriodFilterBarProps = {
  basePath: string;
  year: number;
  month?: number;
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

export function PeriodFilterBar({ basePath, year, month }: PeriodFilterBarProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  return (
    <form method="get" action={basePath} className="portal-filter-bar flex-wrap">
      <label className="flex min-w-[8rem] flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Year
        <select name="year" defaultValue={String(year)} className="lunar-input">
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-[10rem] flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Month
        <select name="month" defaultValue={month ? String(month) : ""} className="lunar-input">
          {MONTHS.map((m) => (
            <option key={m.value || "all"} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="lunar-btn-secondary self-end">
        Apply
      </button>
    </form>
  );
}
