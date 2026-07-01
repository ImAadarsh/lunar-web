type SiteOption = { id: number; name: string };
type GuardOption = { id: number; name: string };

type PingsFilterBarProps = {
  basePath: string;
  date: string;
  siteId: string;
  userId: string;
  status: string;
  threadId?: string;
  sites: SiteOption[];
  guards: GuardOption[];
};

export function PingsFilterBar({
  basePath,
  date,
  siteId,
  userId,
  status,
  threadId,
  sites,
  guards,
}: PingsFilterBarProps) {
  return (
    <form method="get" action={basePath} className="portal-filter-bar flex-wrap">
      {threadId ? <input type="hidden" name="threadId" value={threadId} /> : null}
      <label className="flex min-w-[10rem] flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">
        Date (UK)
        <input name="date" type="date" defaultValue={date} required className="lunar-input" />
      </label>
      <label className="flex min-w-[10rem] flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">
        Site
        <select name="siteId" defaultValue={siteId} className="lunar-input">
          <option value="">All sites</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-[10rem] flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">
        Guard
        <select name="userId" defaultValue={userId} className="lunar-input">
          <option value="">All guards</option>
          {guards.map((guard) => (
            <option key={guard.id} value={guard.id}>
              {guard.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-[10rem] flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">
        Status
        <select name="status" defaultValue={status} className="lunar-input">
          <option value="">All statuses</option>
          <option value="upcoming">Upcoming</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
        </select>
      </label>
      <button type="submit" className="lunar-btn-secondary self-end">
        Apply
      </button>
    </form>
  );
}
