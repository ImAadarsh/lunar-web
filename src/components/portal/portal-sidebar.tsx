"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";
import type { SessionUser } from "@/lib/session";
import { webRoleLabel } from "@/lib/session";
import { PortalNav, type PortalNavLink } from "@/components/portal/portal-nav";
import { PortalSidebarFooter } from "@/components/portal/portal-sidebar-footer";
import { PortalSidebarTooltip } from "@/components/portal/portal-sidebar-tooltip";
import { usePortalSidebar } from "@/components/portal/portal-sidebar-context";

type PortalSidebarProps = {
  user: SessionUser;
  links: PortalNavLink[];
};

function IconPanelClose() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="m14 9 3 3-3 3" />
    </svg>
  );
}

function IconPanelOpen() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="m13 9-3 3 3 3" />
    </svg>
  );
}

export function PortalSidebar({ user, links }: PortalSidebarProps) {
  const { collapsed, toggle } = usePortalSidebar();

  return (
    <aside
      className={cn("portal-sidebar", collapsed && "portal-sidebar--collapsed")}
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div className="portal-sidebar-glow" aria-hidden />
      <div className={cn("portal-sidebar-brand", collapsed && "portal-sidebar-brand--collapsed")}>
        <PortalSidebarTooltip label="Lunar Security" description="Operations" show={collapsed}>
          <Image
            src="/api/assets/logo?variant=transparent"
            alt="Lunar Security"
            width={40}
            height={40}
            unoptimized
            className="portal-sidebar-logo shrink-0"
          />
        </PortalSidebarTooltip>
        <div className="portal-sidebar-brand-text">
          <p className="portal-sidebar-brand-eyebrow">Lunar Security</p>
          <p className="portal-sidebar-brand-title">Operations</p>
        </div>
        <PortalSidebarTooltip
          label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          show={collapsed}
          className={cn(collapsed && "w-full")}
        >
          <button
            type="button"
            onClick={toggle}
            className={cn("portal-sidebar-toggle", collapsed ? "h-8 w-full" : "h-8 w-8")}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={!collapsed ? "Collapse sidebar" : undefined}
          >
            {collapsed ? <IconPanelOpen /> : <IconPanelClose />}
          </button>
        </PortalSidebarTooltip>
      </div>

      <PortalNav links={links} variant="sidebar" collapsed={collapsed} />

      <div className="portal-sidebar-footer">
        <PortalSidebarTooltip
          label={user.email}
          description={webRoleLabel(user.role)}
          show={collapsed}
          className="w-full justify-center"
        >
          <div className={cn("portal-sidebar-user-card", collapsed && "portal-sidebar-user-card--collapsed")}>
            {!collapsed ? (
              <>
                <p className="portal-sidebar-user-label">Signed in</p>
                <p className="portal-sidebar-user-email">{user.email}</p>
                <p className="portal-sidebar-user-role">{webRoleLabel(user.role)}</p>
              </>
            ) : (
              <span className="portal-sidebar-user-initial" aria-label={user.email}>
                {user.email.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </PortalSidebarTooltip>
        <PortalSidebarFooter collapsed={collapsed} />
      </div>
    </aside>
  );
}
