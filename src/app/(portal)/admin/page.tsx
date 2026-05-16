import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/server-session";

/** Admins use the unified operations overview at /manager. */
export default async function AdminPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/forbidden");
  redirect("/manager");
}
