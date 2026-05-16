"use client";

import { useState } from "react";
import { PortalSidebarTooltip } from "@/components/portal/portal-sidebar-tooltip";
import { cn } from "@/lib/cn";

type LogoutButtonProps = {
  variant?: "default" | "sidebar";
  collapsed?: boolean;
  className?: string;
};

function IconLogout() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function LogoutButton({ variant = "default", collapsed = false, className }: LogoutButtonProps) {
  const sidebar = variant === "sidebar";
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } finally {
      setLoading(false);
    }
  }

  const button = (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={cn(
        sidebar
          ? cn(
              "portal-sidebar-control inline-flex w-full items-center justify-center rounded-lg text-sm font-semibold transition disabled:opacity-60",
              collapsed ? "h-9 px-0" : "gap-2 px-3 py-2",
            )
          : "lunar-btn-secondary shrink-0",
        loading && "lunar-shimmer",
        className,
      )}
    >
      {loading ? (
        <>
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-lunar-600" />
          {sidebar && collapsed ? null : "Signing out…"}
        </>
      ) : sidebar && collapsed ? (
        <IconLogout />
      ) : (
        "Sign out"
      )}
    </button>
  );

  if (sidebar && collapsed) {
    return (
      <PortalSidebarTooltip label="Sign out" show>
        {button}
      </PortalSidebarTooltip>
    );
  }

  return button;
}
