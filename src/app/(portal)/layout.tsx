import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { getSessionFromCookies } from "@/lib/server-session";

export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  return <PortalShell user={session.user}>{children}</PortalShell>;
}

