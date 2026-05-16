"use client";

import { FocusPortalShell } from "@/components/focus-portal-shell";
import { PortalShell } from "@/components/portal-shell";
import { PortalFocusProvider } from "@/components/portal/portal-focus-context";
import { PortalThemeProvider } from "@/components/portal/portal-theme-provider";
import { isFocusDashboardPath } from "@/lib/portal-focus";
import type { SessionUser } from "@/lib/session";
import { usePathname } from "next/navigation";

type PortalChromeProps = {
  user: SessionUser;
  children: React.ReactNode;
};

export function PortalChrome({ user, children }: PortalChromeProps) {
  const pathname = usePathname();
  const focus = isFocusDashboardPath(pathname);

  return (
    <PortalThemeProvider>
      {focus ? (
        <PortalFocusProvider value>
          <FocusPortalShell user={user}>{children}</FocusPortalShell>
        </PortalFocusProvider>
      ) : (
        <PortalFocusProvider value={false}>
          <PortalShell user={user}>{children}</PortalShell>
        </PortalFocusProvider>
      )}
    </PortalThemeProvider>
  );
}
