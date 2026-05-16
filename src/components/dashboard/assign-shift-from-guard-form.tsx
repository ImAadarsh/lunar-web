import { assignGuardShiftAction } from "@/lib/shift-dashboard-actions";

type TrainedSiteOption = {
  siteId: number;
  siteName: string;
};

type AssignShiftFromGuardFormProps = {
  userId: number;
  trainedSites: TrainedSiteOption[];
};

export function AssignShiftFromGuardForm({ userId, trainedSites }: AssignShiftFromGuardFormProps) {
  if (trainedSites.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        This guard has no site training records. Assign training before scheduling shifts.
      </p>
    );
  }

  return (
    <form action={assignGuardShiftAction} className="space-y-3">
      <input type="hidden" name="userId" value={String(userId)} />
      <label className="block text-sm text-slate-600">
        Site (trained only)
        <select name="siteId" required className="mt-1 w-full lunar-select" defaultValue="">
          <option value="" disabled>
            Select trained site
          </option>
          {trainedSites.map((site) => (
            <option key={site.siteId} value={site.siteId}>
              {site.siteName}
            </option>
          ))}
        </select>
      </label>
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
      <button type="submit" className="lunar-btn-primary w-full sm:w-auto">
        Schedule shift
      </button>
    </form>
  );
}
