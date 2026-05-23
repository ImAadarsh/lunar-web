import Link from "next/link";
import { cn } from "@/lib/cn";

export type DashboardTab = {
  id: string;
  label: string;
  /** When true, navigating to this tab drops `from`/`to` so the page resolves its own default range. */
  resetDates?: boolean;
};

type DashboardTabNavProps = {
  basePath: string;
  tabs: DashboardTab[];
  activeTab: string;
  from: string;
  to: string;
};

export function DashboardTabNav({ basePath, tabs, activeTab, from, to }: DashboardTabNavProps) {
  return (
    <nav
      className="flex flex-wrap gap-1 border-b border-[var(--portal-border)] pb-px"
      aria-label="Dashboard sections"
    >
      {tabs.map((tab) => {
        const params = tab.resetDates
          ? new URLSearchParams({ tab: tab.id })
          : new URLSearchParams({ from, to, tab: tab.id });
        const href = `${basePath}?${params}`;
        const active = activeTab === tab.id;
        return (
          <Link
            key={tab.id}
            href={href}
            className={cn(
              "rounded-t-lg px-3 py-2 text-sm font-semibold transition",
              active
                ? "-mb-px border border-[var(--portal-border)] border-b-[var(--portal-surface)] bg-[var(--portal-surface)] text-[var(--portal-text)]"
                : "text-[var(--portal-text-muted)] hover:bg-[var(--portal-table-row-hover)] hover:text-[var(--portal-text)]",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
