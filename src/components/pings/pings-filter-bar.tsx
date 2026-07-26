"use client";

import Link from "next/link";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { FilterDrawer } from "@/components/portal/filter-drawer";
import { formatUkDateOnly } from "@/lib/format-datetime";

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
  const siteName = siteId ? sites.find((s) => String(s.id) === siteId)?.name : null;
  const guardName = userId ? guards.find((g) => String(g.id) === userId)?.name : null;
  const summary =
    [formatUkDateOnly(date), siteName, guardName, status || null].filter(Boolean).join(" · ") || undefined;

  return (
    <FilterDrawer
      title="Ping filters"
      description="Filter shift chat threads by date, site, guard, and status."
      summary={summary}
      triggerLabel="Filters"
    >
      <form method="get" action={basePath} className="flex flex-col gap-4">
        {threadId ? <input type="hidden" name="threadId" value={threadId} /> : null}
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">
          Date (UK)
          <input name="date" type="date" defaultValue={date} required className="lunar-input" />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">
          Site
          <SearchableSelect
            name="siteId"
            defaultValue={siteId}
            emptyLabel="All sites"
            searchPlaceholder="Search sites…"
            options={sites.map((site) => ({ value: String(site.id), label: site.name }))}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">
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
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">
          Status
          <select name="status" defaultValue={status} className="lunar-input">
            <option value="">All statuses</option>
            <option value="upcoming">Upcoming</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <div className="mt-2 flex flex-wrap gap-2 border-t border-[var(--portal-border)] pt-4">
          <button type="submit" className="lunar-btn-primary">
            Apply
          </button>
          <Link href={basePath} className="lunar-btn-secondary">
            Reset
          </Link>
        </div>
      </form>
    </FilterDrawer>
  );
}
