"use client";

import { useState } from "react";
import { SearchableGuardPicker } from "@/components/dashboard/searchable-guard-picker";
import { assignGuardShiftAction } from "@/lib/shift-dashboard-actions";
import type { GuardAvailabilityInfo } from "@/lib/guard-availability";

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
  const [userId, setUserId] = useState<number | null>(null);
  const assignable = guards.filter((g) => g.availability.canAssign);
  const selectedAssignable = userId != null && assignable.some((g) => g.userId === userId);

  if (guards.length === 0) {
    return <p className="text-sm text-[var(--portal-text-muted)]">No guards are trained for this site yet.</p>;
  }

  return (
    <form action={assignGuardShiftAction} className="space-y-3">
      <input type="hidden" name="siteId" value={String(siteId)} />
      <input type="hidden" name="userId" value={userId ?? ""} />

      <div>
        <p className="text-sm font-medium text-[var(--portal-text)]">Guard (trained &amp; assignable)</p>
        <SearchableGuardPicker
          guards={guards}
          value={userId}
          onChange={setUserId}
          emptyMessage="No trained guards match your search."
        />
      </div>

      {assignable.length === 0 ? (
        <p className="text-xs text-amber-800">
          No guards can be assigned right now (on duty, assigned, duty not started, or recharging).
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm text-[var(--portal-text-muted)]">
          Start
          <input name="startsAt" type="datetime-local" required className="mt-1 w-full lunar-input" />
        </label>
        <label className="block text-sm text-[var(--portal-text-muted)]">
          End
          <input name="endsAt" type="datetime-local" required className="mt-1 w-full lunar-input" />
        </label>
      </div>

      <button
        type="submit"
        className="lunar-btn-primary w-full sm:w-auto"
        disabled={!selectedAssignable}
      >
        Assign guard to site
      </button>
    </form>
  );
}
