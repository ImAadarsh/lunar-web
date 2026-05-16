"use client";

import Link from "next/link";
import { Suspense } from "react";
import { LogoutButton } from "@/components/logout-button";
import { PortalBackLink } from "@/components/portal/portal-back-link";
import { PortalThemeSwitcher } from "@/components/portal/portal-theme-switcher";
import {
  FocusDashboardHeaderProvider,
  useFocusDashboardHeader,
} from "@/components/portal/focus-dashboard-header-context";
import { focusDashboardBackHref } from "@/lib/portal-focus";
import type { SessionUser } from "@/lib/session";
import { usePathname } from "next/navigation";

type FocusPortalShellProps = {
  user: SessionUser;
  children: React.ReactNode;
};

function FocusPortalShellInner({ user, children }: FocusPortalShellProps) {
  const pathname = usePathname();
  const backHref = focusDashboardBackHref(pathname, user.role);
  const headerCtx = useFocusDashboardHeader();

  return (
    <div className="lunar-page-bg flex min-h-dvh flex-col">
      <div className="lunar-page-glow pointer-events-none fixed inset-0 opacity-30" aria-hidden />
      <header className="sticky top-0 z-40 flex shrink-0 items-center gap-2 border-b border-[var(--portal-border)] bg-[var(--portal-header-bg)] px-3 py-2.5 shadow-sm backdrop-blur-md sm:gap-3 sm:px-4">
        <Suspense
          fallback={
            <Link href={backHref} className="lunar-btn-secondary lunar-btn-sm shrink-0">
              ← Back
            </Link>
          }
        >
          <PortalBackLink fallbackHref={backHref} className="lunar-btn-secondary lunar-btn-sm shrink-0">
            ← Back
          </PortalBackLink>
        </Suspense>
        <div className="flex min-h-[2.5rem] min-w-0 flex-1 items-center justify-center gap-2 sm:gap-3">
          {headerCtx?.content ?? null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PortalThemeSwitcher />
          <LogoutButton />
        </div>
      </header>
      <main className="relative z-10 min-h-0 flex-1 overflow-hidden p-3 sm:p-4">{children}</main>
    </div>
  );
}

export function FocusPortalShell({ user, children }: FocusPortalShellProps) {
  return (
    <FocusDashboardHeaderProvider>
      <FocusPortalShellInner user={user}>{children}</FocusPortalShellInner>
    </FocusDashboardHeaderProvider>
  );
}
