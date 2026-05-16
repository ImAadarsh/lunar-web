"use client";

import { LogoutButton } from "@/components/logout-button";
import { PortalThemeSwitcher } from "@/components/portal/portal-theme-switcher";
import { cn } from "@/lib/cn";

/** Theme + sign out — pinned to the bottom of the operations sidebar. */
export function PortalSidebarFooter({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        "relative border-t pt-3",
        collapsed ? "space-y-1.5 border-[var(--portal-sidebar-divider)]" : "space-y-2 border-white/10",
      )}
    >
      <PortalThemeSwitcher variant="sidebar" collapsed={collapsed} />
      <LogoutButton variant="sidebar" collapsed={collapsed} className="w-full" />
    </div>
  );
}
