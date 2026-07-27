"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DutyScheduleHint } from "@/components/dashboard/duty-schedule-hint";
import { ForceAssignField } from "@/components/dashboard/force-assign-field";
import { ActionFeedback } from "@/components/forms/action-feedback";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { UkDateTimeHint } from "@/components/forms/uk-datetime-hint";
import { bulkScheduleShiftsAction } from "@/lib/shift-dashboard-actions";
import {
  availabilityForProposedStart,
  GUARD_RECHARGE_HOURS,
  type GuardAvailabilityInfo,
  type GuardDutyWindow,
} from "@/lib/guard-availability";
import { formatUkDateTime } from "@/lib/format-datetime";
import { ukDateTimeLocalToIso } from "@/lib/uk-datetime";

type TrainedSiteOption = {
  siteId: number;
  siteName: string;
};

type ShiftRow = {
  key: string;
  startsAt: string;
  endsAt: string;
};

type AssignShiftFromGuardFormProps = {
  userId: number;
  trainedSites: TrainedSiteOption[];
  isAdmin: boolean;
  availability?: GuardAvailabilityInfo | null;
  /** When set, site is fixed (e.g. assigning from a site page). */
  lockedSiteId?: number;
};

function newRow(): ShiftRow {
  return { key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, startsAt: "", endsAt: "" };
}

function toMs(local: string): number | null {
  if (!local.trim()) return null;
  const ms = new Date(ukDateTimeLocalToIso(local)).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function AssignShiftFromGuardForm({
  userId,
  trainedSites,
  isAdmin,
  availability = null,
  lockedSiteId,
}: AssignShiftFromGuardFormProps) {
  const router = useRouter();
  const [rows, setRows] = useState<ShiftRow[]>(() => [newRow()]);
  const [siteId, setSiteId] = useState(lockedSiteId ? String(lockedSiteId) : "");
  const [force, setForce] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const rowStatuses = useMemo(() => {
    if (!availability) return rows.map(() => null);
    const batch: GuardDutyWindow[] = [];
    return rows.map((row) => {
      const startMs = toMs(row.startsAt);
      const endMs = toMs(row.endsAt);
      const status = availabilityForProposedStart(availability, startMs, endMs, batch);
      if (startMs != null && endMs != null && row.startsAt && row.endsAt) {
        batch.push({
          startsAt: ukDateTimeLocalToIso(row.startsAt),
          endsAt: ukDateTimeLocalToIso(row.endsAt),
          status: "scheduled",
        });
      }
      return status;
    });
  }, [availability, rows]);

  if (trainedSites.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        This guard has no site training records. Assign training before scheduling shifts.
      </p>
    );
  }

  const hasConflict = rowStatuses.some((s) => s && !s.canAssign);
  const allTimesFilled = rows.every((r) => r.startsAt.trim() && r.endsAt.trim());
  const blocked = Boolean((!siteId || !allTimesFilled || (hasConflict && !(isAdmin && force))) || saving);

  function updateRow(key: string, patch: Partial<ShiftRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (blocked) return;
    const fd = new FormData();
    fd.set("userId", String(userId));
    fd.set("siteId", siteId);
    if (force) fd.set("force", "1");
    rows.forEach((row, i) => {
      fd.set(`shift_${i}_startsAt`, row.startsAt);
      fd.set(`shift_${i}_endsAt`, row.endsAt);
    });
    fd.set("shiftCount", String(rows.length));
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await bulkScheduleShiftsAction(fd);
      setSuccess(result.message);
      setRows([newRow()]);
      if (!lockedSiteId) setSiteId("");
      setForce(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save shifts.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <DutyScheduleHint />
      <ActionFeedback success={success} error={error} />

      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-800">Shift times (UK) — set these first</p>
        {rows.map((row, index) => {
          const status = rowStatuses[index];
          return (
            <div key={row.key} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Shift {index + 1}
                </p>
                {rows.length > 1 ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-rose-700 hover:underline"
                    onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm text-slate-600">
                  Start
                  <input
                    type="datetime-local"
                    required
                    value={row.startsAt}
                    onChange={(e) => updateRow(row.key, { startsAt: e.target.value })}
                    className="mt-1 w-full lunar-input"
                  />
                </label>
                <label className="block text-sm text-slate-600">
                  End
                  <input
                    type="datetime-local"
                    required
                    value={row.endsAt}
                    onChange={(e) => updateRow(row.key, { endsAt: e.target.value })}
                    className="mt-1 w-full lunar-input"
                  />
                </label>
              </div>
              {status && toMs(row.startsAt) != null && !status.canAssign ? (
                <p className="text-xs text-amber-900">
                  {status.label}
                  {status.rechargingUntil
                    ? ` — earliest ${formatUkDateTime(status.rechargingUntil)} (${GUARD_RECHARGE_HOURS}h after prior duty)`
                    : ""}
                </p>
              ) : null}
              {status && toMs(row.startsAt) != null && status.canAssign ? (
                <p className="text-xs text-emerald-800">Free for this start</p>
              ) : null}
            </div>
          );
        })}
        <UkDateTimeHint />
        <button
          type="button"
          className="lunar-btn-secondary lunar-btn-sm"
          onClick={() => setRows((prev) => [...prev, newRow()])}
        >
          Add another shift
        </button>
      </div>

      {lockedSiteId ? (
        <input type="hidden" name="siteId" value={String(lockedSiteId)} />
      ) : (
        <label className="block text-sm text-slate-600">
          Site (trained only)
          <SearchableSelect
            name="siteId"
            required
            placeholder="Select trained site"
            searchPlaceholder="Search trained sites…"
            className="mt-1"
            value={siteId}
            onChange={setSiteId}
            options={trainedSites.map((site) => ({
              value: String(site.siteId),
              label: site.siteName,
            }))}
          />
        </label>
      )}

      <ForceAssignField isAdmin={isAdmin} checked={force} onCheckedChange={setForce} />

      <button type="submit" className="lunar-btn-primary w-full sm:w-auto" disabled={blocked}>
        {saving
          ? "Saving…"
          : rows.length > 1
            ? `Save ${rows.length} shifts`
            : "Schedule shift"}
      </button>
    </form>
  );
}
