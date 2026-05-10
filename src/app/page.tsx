import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/server-session";

export default async function Home() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");

  if (session.user.role === "admin") redirect("/admin");
  if (session.user.role === "supervisor") redirect("/manager");
  redirect("/staff");
}
