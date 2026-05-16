import Link from "next/link";
import type { DashboardAlert } from "@/lib/dashboard-types";
import { cn } from "@/lib/cn";

const severityStyles: Record<DashboardAlert["severity"], string> = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  critical: "border-rose-200 bg-rose-50 text-rose-950",
};

export function DashboardAlerts({ alerts }: { alerts: DashboardAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <ul className="space-y-2">
      {alerts.map((alert) => (
        <li
          key={`${alert.code}-${alert.message}`}
          className={cn("rounded-lg border px-3 py-2 text-sm", severityStyles[alert.severity])}
        >
          {alert.href ? (
            <Link href={alert.href} className="font-medium underline underline-offset-2">
              {alert.message}
            </Link>
          ) : (
            <span className="font-medium">{alert.message}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
