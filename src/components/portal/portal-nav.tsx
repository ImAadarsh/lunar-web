"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { PortalSidebarTooltip } from "@/components/portal/portal-sidebar-tooltip";
import type { BackendRole } from "@/lib/session";

export type PortalNavLink = {
  href: string;
  label: string;
  roles: BackendRole[];
  icon: React.ReactNode;
};

function isActive(pathname: string, href: string) {
  if (href === "/admin" || href === "/manager" || href === "/staff") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalNav({
  links,
  variant,
  collapsed = false,
}: {
  links: PortalNavLink[];
  variant: "sidebar" | "mobile";
  collapsed?: boolean;
}) {
  const pathname = usePathname();

  if (variant === "mobile") {
    return (
      <nav className="flex gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="Mobile navigation">
        {links.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition duration-200",
                active
                  ? "border-lunar-300 bg-lunar-700 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-lunar-200 hover:bg-lunar-50",
              )}
            >
              <span className={cn("opacity-80", active && "text-lunar-100")}>{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      className={cn(
        "mt-5 flex-1 space-y-[3px] pr-0.5",
        collapsed ? "portal-sidebar-nav--collapsed" : "overflow-y-auto",
      )}
      aria-label="Main navigation"
    >
      {links.map((link) => {
        const active = isActive(pathname, link.href);
        const linkEl = (
          <Link
            href={link.href}
            className={cn(
              "portal-sidebar-nav-link",
              active && "portal-sidebar-nav-link--active",
              collapsed && "portal-sidebar-nav-link--collapsed",
            )}
          >
            {active && !collapsed ? <span className="portal-sidebar-nav-indicator" aria-hidden /> : null}
            <span className="portal-sidebar-nav-icon">{link.icon}</span>
            <span className="portal-sidebar-nav-label truncate">{link.label}</span>
          </Link>
        );

        return (
          <PortalSidebarTooltip key={link.href} label={link.label} show={collapsed} accent={active}>
            {linkEl}
          </PortalSidebarTooltip>
        );
      })}
    </nav>
  );
}
