import Link from "next/link";
import { formatHours } from "@/lib/dashboard-api";
import { formatUkDateTime } from "@/lib/format-datetime";
import type { RecentAttendanceRow } from "@/lib/dashboard-types";

export function AttendanceTimeline({ rows }: { rows: RecentAttendanceRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No check-in history yet.</p>;
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
          <div>
            <Link href={`/manager/sites/${row.siteId}`} className="font-medium text-lunar-800 hover:underline">
              {row.siteName}
            </Link>
            <p className="text-xs text-slate-500">
              In {formatUkDateTime(row.checkInAt)}
              {row.checkOutAt ? ` · Out ${formatUkDateTime(row.checkOutAt)}` : " · Still open"}
            </p>
          </div>
          <span className="tabular-nums font-semibold text-slate-800">{formatHours(row.hours)}</span>
        </li>
      ))}
    </ul>
  );
}
