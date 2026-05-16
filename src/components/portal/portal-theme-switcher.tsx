"use client";

import { PORTAL_THEMES, type PortalThemeId } from "@/lib/portal-theme";
import { cn } from "@/lib/cn";
import { PortalSidebarTooltip } from "@/components/portal/portal-sidebar-tooltip";
import { usePortalTheme } from "@/components/portal/portal-theme-provider";

type PortalThemeSwitcherProps = {
  className?: string;
  variant?: "default" | "sidebar";
  collapsed?: boolean;
};

const THEME_SHORT: Record<string, string> = {
  default: "D",
  dark: "K",
  coloured: "C",
};

export function PortalThemeSwitcher({
  className,
  variant = "default",
  collapsed = false,
}: PortalThemeSwitcherProps) {
  const { theme, setTheme } = usePortalTheme();
  const sidebar = variant === "sidebar";

  return (
    <div
      className={cn(
        "flex w-full gap-0.5 rounded-lg p-0.5",
        sidebar && collapsed ? "flex-col" : "items-center",
        sidebar
          ? "portal-sidebar-control flex w-full rounded-lg p-0.5"
          : "border border-[var(--portal-border)] bg-[var(--portal-surface-muted)]",
        className,
      )}
      role="group"
      aria-label="Portal theme"
    >
      {PORTAL_THEMES.map((option) => {
        const active = theme === option.id;
        const btn = (
          <button
            type="button"
            onClick={() => setTheme(option.id as PortalThemeId)}
            className={cn(
              "rounded-md font-semibold transition duration-200",
              sidebar && collapsed
                ? "flex h-8 w-full items-center justify-center text-xs"
                : "flex-1 px-1.5 py-1.5 text-[0.65rem] sm:px-2 sm:text-xs",
              sidebar
                ? cn(
                    "border-0 bg-transparent text-[var(--portal-sidebar-control-text)] hover:bg-[var(--portal-sidebar-nav-hover-bg)] hover:text-[var(--portal-sidebar-nav-hover-text)]",
                    active && "portal-sidebar-control--active shadow-sm",
                  )
                : active
                  ? "bg-[var(--portal-accent)] text-[var(--portal-accent-fg)] shadow-sm"
                  : "text-[var(--portal-text-muted)] hover:bg-[var(--portal-surface)] hover:text-[var(--portal-text)]",
            )}
            aria-pressed={active}
          >
            {sidebar && collapsed ? THEME_SHORT[option.id] ?? option.label.charAt(0) : option.label}
          </button>
        );

        return (
          <PortalSidebarTooltip key={option.id} label={option.label} show={sidebar && collapsed}>
            {btn}
          </PortalSidebarTooltip>
        );
      })}
    </div>
  );
}
