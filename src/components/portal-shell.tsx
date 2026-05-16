import {
  IconAlert,
  IconBadge,
  IconCalendar,
  IconDashboard,
  IconFile,
  IconMapPin,
  IconRadio,
  IconShield,
  IconUsers,
  IconWallet,
} from "@/components/portal/nav-icons";
import { PortalNav, type PortalNavLink } from "@/components/portal/portal-nav";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { PortalSidebarProvider } from "@/components/portal/portal-sidebar-context";
import { PortalThemeSwitcher } from "@/components/portal/portal-theme-switcher";
import { LogoutButton } from "@/components/logout-button";
import type { SessionUser } from "@/lib/session";

type PortalShellProps = {
  user: SessionUser;
  children: React.ReactNode;
};

const links: PortalNavLink[] = [
  { href: "/manager", label: "Overview", roles: ["admin", "supervisor"], icon: <IconDashboard /> },
  { href: "/manager/command-center", label: "Command Center", roles: ["admin", "supervisor"], icon: <IconRadio /> },
  { href: "/manager/shifts", label: "Shifts", roles: ["admin", "supervisor"], icon: <IconCalendar /> },
  { href: "/manager/incidents", label: "Incidents & SOS", roles: ["admin", "supervisor"], icon: <IconAlert /> },
  { href: "/manager/leave", label: "Leave", roles: ["admin", "supervisor"], icon: <IconCalendar /> },
  { href: "/manager/training", label: "Training", roles: ["admin", "supervisor"], icon: <IconBadge /> },
  { href: "/admin/users", label: "Users", roles: ["admin"], icon: <IconUsers /> },
  { href: "/admin/sites", label: "Sites", roles: ["admin"], icon: <IconMapPin /> },
  { href: "/admin/checkpoints", label: "Checkpoints", roles: ["admin"], icon: <IconShield /> },
  { href: "/admin/payroll", label: "Payroll", roles: ["admin"], icon: <IconWallet /> },
  { href: "/admin/reports", label: "Reports", roles: ["admin"], icon: <IconFile /> },
  { href: "/staff", label: "Overview", roles: ["guard"], icon: <IconDashboard /> },
  { href: "/staff/leave", label: "My Leave", roles: ["guard"], icon: <IconCalendar /> },
  { href: "/staff/incidents", label: "My Incidents", roles: ["guard"], icon: <IconAlert /> },
];

export function PortalShell({ user, children }: PortalShellProps) {
  const allowed = links.filter((link) => link.roles.includes(user.role));

  return (
    <PortalSidebarProvider>
      <div className="lunar-page-bg min-h-screen">
        <div className="lunar-page-glow pointer-events-none fixed inset-0 opacity-30" aria-hidden />

        <div className="relative flex min-h-screen w-full flex-col gap-3 overflow-visible p-3 sm:gap-4 sm:p-4 lg:flex-row lg:gap-5 lg:p-5 xl:gap-6 xl:p-6">
          <PortalSidebar user={user} links={allowed} />

          <div className="portal-main flex min-h-0 min-w-0 flex-1 flex-col gap-3 sm:gap-4 lg:h-[calc(100dvh-2.5rem)] lg:max-h-[calc(100dvh-2.5rem)]">
            <header className="lunar-card-static shrink-0 px-3 py-2 lg:hidden">
              <PortalNav links={allowed} variant="mobile" />
              <div className="mt-2 flex items-center gap-2">
                <PortalThemeSwitcher className="min-w-0 flex-1" />
                <LogoutButton className="shrink-0" />
              </div>
            </header>

            <main className="lunar-main-enter min-h-0 flex-1 overflow-hidden pb-4 sm:pb-5 lg:pb-0">{children}</main>
          </div>
        </div>
      </div>
    </PortalSidebarProvider>
  );
}
