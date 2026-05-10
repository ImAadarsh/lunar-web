import Image from "next/image";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import type { BackendRole, SessionUser } from "@/lib/session";
import { webRoleLabel } from "@/lib/session";

type PortalShellProps = {
  user: SessionUser;
  children: React.ReactNode;
};

type NavLink = {
  href: string;
  label: string;
  roles: BackendRole[];
};

const links: NavLink[] = [
  { href: "/admin", label: "Admin Console", roles: ["admin"] },
  { href: "/admin/users", label: "Users", roles: ["admin"] },
  { href: "/admin/sites", label: "Sites", roles: ["admin"] },
  { href: "/admin/checkpoints", label: "Checkpoints", roles: ["admin"] },
  { href: "/admin/payroll", label: "Payroll", roles: ["admin"] },
  { href: "/admin/reports", label: "Reports / Exports", roles: ["admin"] },
  { href: "/manager", label: "Manager Console", roles: ["admin", "supervisor"] },
  { href: "/manager/command-center", label: "Command Center", roles: ["admin", "supervisor"] },
  { href: "/manager/shifts", label: "Shifts", roles: ["admin", "supervisor"] },
  { href: "/manager/incidents", label: "Incidents & SOS", roles: ["admin", "supervisor"] },
  { href: "/manager/leave", label: "Leave Decisions", roles: ["admin", "supervisor"] },
  { href: "/manager/certifications", label: "Certifications", roles: ["admin", "supervisor"] },
  { href: "/staff", label: "Staff Console", roles: ["guard"] },
  { href: "/staff/leave", label: "My Leave", roles: ["guard"] },
  { href: "/staff/incidents", label: "My Incidents", roles: ["guard"] },
];

export function PortalShell({ user, children }: PortalShellProps) {
  const allowed = links.filter((link) => link.roles.includes(user.role));
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-4 p-3 sm:p-4 lg:flex-row lg:gap-5 lg:p-6">
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-64 shrink-0 flex-col rounded-2xl bg-lunar-950 p-5 text-white shadow-xl lg:flex xl:w-72">
          <div className="flex items-center gap-3">
            <Image
              src="/api/assets/logo?variant=transparent"
              alt="Lunar Security"
              width={44}
              height={44}
              className="rounded-lg bg-white/10 p-1"
            />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-lunar-200">Lunar Security</p>
              <p className="font-semibold">Web Panel</p>
            </div>
          </div>

          <nav className="mt-8 flex-1 space-y-2 overflow-y-auto pr-1">
            {allowed.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-lg px-3 py-2 text-sm text-lunar-100 transition hover:bg-white/10"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto rounded-xl bg-white/10 p-3 text-sm">
            <p className="text-lunar-200">Signed in as</p>
            <p className="truncate font-semibold">{user.email}</p>
            <p className="text-lunar-200">{webRoleLabel(user.role)}</p>
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-4 overflow-x-hidden">
          <header className="rounded-2xl bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.24em] text-lunar-700">Operations Panel</p>
                <h1 className="truncate text-xl font-bold text-lunar-950">
                  {webRoleLabel(user.role)} Workspace
                </h1>
              </div>
              <LogoutButton />
            </div>
            <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {allowed.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="shrink-0 rounded-full border border-lunar-100 bg-lunar-50 px-3 py-1.5 text-xs font-semibold text-lunar-800"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </header>
          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}

