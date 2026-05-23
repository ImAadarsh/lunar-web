import { GUARD_RECHARGE_HOURS } from "@/lib/guard-availability";

export function DutyScheduleHint() {
  return (
    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
      One duty per guard per <strong>duty day</strong> (date of shift start — e.g. 21:00–06:00 uses the
      evening&apos;s date). New duties need a {GUARD_RECHARGE_HOURS}-hour gap after the previous duty ends
      unless you force assign as admin.
    </p>
  );
}
