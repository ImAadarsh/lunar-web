import { assignGuardShiftAction } from "@/lib/shift-dashboard-actions";
import { guardAvailabilityLabel, type GuardAvailabilityInfo } from "@/lib/guard-availability";

type TrainedGuardOption = {
  userId: number;
  label: string;
  availability: GuardAvailabilityInfo;
};

type AssignShiftFromSiteFormProps = {
  siteId: number;
  guards: TrainedGuardOption[];
};

export function AssignShiftFromSiteForm({ siteId, guards }: AssignShiftFromSiteFormProps) {
  const assignable = guards.filter((g) => g.availability.canAssign);

  if (guards.length === 0) {
    return <p className="text-sm text-slate-500">No guards are trained for this site yet.</p>;
  }

  return (
    <form action={assignGuardShiftAction} className="space-y-3">
      <input type="hidden" name="siteId" value={String(siteId)} />
      <label className="block text-sm text-slate-600">
        Guard (trained & assignable)
        <select name="userId" required className="mt-1 w-full lunar-select" defaultValue="">
          <option value="" disabled>
            Select guard
          </option>
          {guards.map((guard) => (
            <option key={guard.userId} value={guard.userId} disabled={!guard.availability.canAssign}>
              {guard.label} — {guardAvailabilityLabel(guard.availability.state)}
            </option>
          ))}
        </select>
      </label>
      {assignable.length === 0 ? (
        <p className="text-xs text-amber-800">
          No guards can be assigned right now (on duty, assigned, duty not started, or recharging).
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm text-slate-600">
          Start
          <input name="startsAt" type="datetime-local" required className="mt-1 w-full lunar-input" />
        </label>
        <label className="block text-sm text-slate-600">
          End
          <input name="endsAt" type="datetime-local" required className="mt-1 w-full lunar-input" />
        </label>
      </div>
      <button type="submit" className="lunar-btn-primary w-full sm:w-auto" disabled={assignable.length === 0}>
        Assign guard to site
      </button>
    </form>
  );
}
