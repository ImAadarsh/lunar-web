import Link from "next/link";
import { cn } from "@/lib/cn";

export type PortalTab = {
  id: string;
  label: string;
};

type PortalTabNavProps = {
  basePath: string;
  tabs: PortalTab[];
  activeTab: string;
  preserved?: Record<string, string | undefined>;
};

/** URL tabs for portal list pages (preserves optional query params per tab). */
export function PortalTabNav({ basePath, tabs, activeTab, preserved }: PortalTabNavProps) {
  return (
    <nav
      className="flex flex-wrap gap-1 border-b border-[var(--portal-border)] pb-px"
      aria-label="Page sections"
    >
      {tabs.map((tab) => {
        const params = new URLSearchParams();
        params.set("tab", tab.id);
        if (preserved) {
          for (const [key, value] of Object.entries(preserved)) {
            if (key === "tab") continue;
            if (value !== undefined && value !== "") params.set(key, value);
          }
        }
        const href = `${basePath}?${params.toString()}`;
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
