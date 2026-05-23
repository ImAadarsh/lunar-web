"use client";

import { useState } from "react";
import { DutyScheduleHint } from "@/components/dashboard/duty-schedule-hint";
import { SearchableGuardPicker } from "@/components/dashboard/searchable-guard-picker";
import { UkDateTimeHint } from "@/components/forms/uk-datetime-hint";
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
  isAdmin: boolean;
};

export function AssignShiftFromSiteForm({ siteId, guards, isAdmin }: AssignShiftFromSiteFormProps) {
  const [userId, setUserId] = useState<number | null>(null);
  const [force, setForce] = useState(false);
  const assignable = guards.filter((g) => g.availability.canAssign);
  const selectedAssignable = userId != null && assignable.some((g) => g.userId === userId);
  const canSubmit = userId != null && (selectedAssignable || (isAdmin && force));

  if (guards.length === 0) {
    return <p className="text-sm text-[var(--portal-text-muted)]">No guards are trained for this site yet.</p>;
  }

  return (
    <form action={assignGuardShiftAction} className="space-y-3">
      <DutyScheduleHint />
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
          Start (UK)
          <input name="startsAt" type="datetime-local" required className="mt-1 w-full lunar-input" />
        </label>
        <label className="block text-sm text-[var(--portal-text-muted)]">
          End (UK)
          <input name="endsAt" type="datetime-local" required className="mt-1 w-full lunar-input" />
        </label>
      </div>
      <UkDateTimeHint />

      {isAdmin ? (
        <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <input
            type="checkbox"
            name="force"
            value="1"
            className="mt-0.5"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
          />
          <span>
            <span className="font-semibold">Force assign</span>
            <span className="mt-0.5 block text-xs text-amber-900/90">
              Bypass one-duty-per-day and 7-hour recharge for this guard.
            </span>
          </span>
        </label>
      ) : null}

      <button
        type="submit"
        className="lunar-btn-primary w-full sm:w-auto"
        disabled={!canSubmit}
      >
        Assign guard to site
      </button>
    </form>
  );
}
