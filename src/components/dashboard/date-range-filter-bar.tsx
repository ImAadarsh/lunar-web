type DateRangeFilterBarProps = {
  basePath: string;
  from: string;
  to: string;
  hiddenParams?: Record<string, string>;
};

export function DateRangeFilterBar({ basePath, from, to, hiddenParams }: DateRangeFilterBarProps) {
  return (
    <form method="get" action={basePath} className="portal-filter-bar flex-wrap">
      {hiddenParams
        ? Object.entries(hiddenParams).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))
        : null}
      <label className="flex min-w-[10rem] flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        From
        <input name="from" type="date" defaultValue={from} required className="lunar-input" />
      </label>
      <label className="flex min-w-[10rem] flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        To
        <input name="to" type="date" defaultValue={to} required className="lunar-input" />
      </label>
      <button type="submit" className="lunar-btn-secondary self-end">
        Apply
      </button>
    </form>
  );
}
