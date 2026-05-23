import { redirect } from "next/navigation";

/** Legacy bookmark — role home is `/`, `/admin`, `/manager`, or `/staff`. */
export default function DashboardRedirectPage() {
  redirect("/");
}
