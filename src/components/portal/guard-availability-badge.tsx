import { formatUkDateTime } from "@/lib/format-datetime";
import {
  guardAvailabilityLabel,
  type GuardAvailabilityInfo,
  GUARD_RECHARGE_HOURS,
} from "@/lib/guard-availability";
import { cn } from "@/lib/cn";

const stateStyles: Record<GuardAvailabilityInfo["state"], string> = {
  available: "border-emerald-200 bg-emerald-50 text-emerald-800",
  recharging: "border-amber-200 bg-amber-50 text-amber-900",
  on_duty: "border-sky-200 bg-sky-50 text-sky-900",
  assigned: "border-violet-200 bg-violet-50 text-violet-900",
  duty_not_started: "border-orange-200 bg-orange-50 text-orange-900",
  missed_duty: "border-rose-200 bg-rose-50 text-rose-900",
  disabled: "border-slate-200 bg-slate-100 text-slate-600",
};

type GuardAvailabilityBadgeProps = {
  info: GuardAvailabilityInfo;
  className?: string;
  showDetail?: boolean;
};

export function GuardAvailabilityBadge({ info, className, showDetail = false }: GuardAvailabilityBadgeProps) {
  return (
    <span className={cn("inline-flex flex-col gap-0.5", className)}>
      <span
        className={cn(
          "inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
          stateStyles[info.state],
        )}
      >
        {guardAvailabilityLabel(info.state)}
      </span>
      {showDetail && info.state === "recharging" && info.rechargingUntil ? (
        <span className="text-xs text-amber-800">
          Available after {formatUkDateTime(info.rechargingUntil)} ({GUARD_RECHARGE_HOURS}h rest)
        </span>
      ) : null}
      {showDetail && info.state === "assigned" ? (
        <span className="text-xs text-violet-800">Upcoming shift scheduled</span>
      ) : null}
      {showDetail && info.state === "duty_not_started" ? (
        <span className="text-xs text-orange-800">Shift started — awaiting check-in</span>
      ) : null}
      {showDetail && info.state === "on_duty" ? (
        <span className="text-xs text-sky-800">Checked in and on active duty</span>
      ) : null}
      {showDetail && info.state === "missed_duty" ? (
        <span className="text-xs text-rose-800">No check-in by 50% of shift — available to reassign</span>
      ) : null}
      {showDetail && info.state === "available" && info.lastShiftEndedAt ? (
        <span className="text-xs text-slate-500">
          Last duty ended {formatUkDateTime(info.lastShiftEndedAt)}
        </span>
      ) : null}
      {showDetail && info.state === "available" && !info.lastShiftEndedAt ? (
        <span className="text-xs text-slate-500">Ready for assignment</span>
      ) : null}
    </span>
  );
}
