"use client";

import { DutyScheduleHint } from "@/components/dashboard/duty-schedule-hint";
import { ForceAssignField } from "@/components/dashboard/force-assign-field";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { UkDateTimeHint } from "@/components/forms/uk-datetime-hint";
import { assignGuardShiftAction } from "@/lib/shift-dashboard-actions";

type TrainedSiteOption = {
  siteId: number;
  siteName: string;
};

type AssignShiftFromGuardFormProps = {
  userId: number;
  trainedSites: TrainedSiteOption[];
  isAdmin: boolean;
};

export function AssignShiftFromGuardForm({
  userId,
  trainedSites,
  isAdmin,
}: AssignShiftFromGuardFormProps) {
  if (trainedSites.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        This guard has no site training records. Assign training before scheduling shifts.
      </p>
    );
  }

  return (
    <form action={assignGuardShiftAction} className="space-y-3">
      <DutyScheduleHint />
      <input type="hidden" name="userId" value={String(userId)} />
      <label className="block text-sm text-slate-600">
        Site (trained only)
        <SearchableSelect
          name="siteId"
          required
          placeholder="Select trained site"
          searchPlaceholder="Search trained sites…"
          className="mt-1"
          options={trainedSites.map((site) => ({
            value: String(site.siteId),
            label: site.siteName,
          }))}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm text-slate-600">
          Start (UK)
          <input name="startsAt" type="datetime-local" required className="mt-1 w-full lunar-input" />
        </label>
        <label className="block text-sm text-slate-600">
          End (UK)
          <input name="endsAt" type="datetime-local" required className="mt-1 w-full lunar-input" />
        </label>
      </div>
      <UkDateTimeHint />
      <ForceAssignField isAdmin={isAdmin} />
      <button type="submit" className="lunar-btn-primary w-full sm:w-auto">
        Schedule shift
      </button>
    </form>
  );
}
