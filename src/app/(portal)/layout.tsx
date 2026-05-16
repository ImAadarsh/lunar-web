import { redirect } from "next/navigation";
import { PortalChrome } from "@/components/portal-chrome";
import { SessionKeepAlive } from "@/components/session-keep-alive";
import { getSessionFromCookies } from "@/lib/server-session";

export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  return (
    <>
      <SessionKeepAlive />
      <PortalChrome user={session.user}>{children}</PortalChrome>
    </>
  );
}

