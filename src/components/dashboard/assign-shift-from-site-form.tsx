"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DutyScheduleHint } from "@/components/dashboard/duty-schedule-hint";
import { SearchableGuardPicker } from "@/components/dashboard/searchable-guard-picker";
import { ActionFeedback } from "@/components/forms/action-feedback";
import { UkDateTimeHint } from "@/components/forms/uk-datetime-hint";
import { assignMultipleSiteShiftsAction } from "@/lib/shift-dashboard-actions";
import {
  availabilityForProposedStart,
  GUARD_RECHARGE_HOURS,
  type GuardAvailabilityInfo,
  type GuardDutyWindow,
} from "@/lib/guard-availability";
import { goToLogin } from "@/lib/session-expired";
import { ukDateTimeLocalToIso } from "@/lib/uk-datetime";

type TrainedGuardOption = {
  userId: number;
  label: string;
  availability: GuardAvailabilityInfo;
};

type ShiftRow = {
  key: string;
  startsAt: string;
  endsAt: string;
  userId: number | null;
};

type AssignShiftFromSiteFormProps = {
  siteId: number;
  guards: TrainedGuardOption[];
  isAdmin: boolean;
};

function newRow(): ShiftRow {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startsAt: "",
    endsAt: "",
    userId: null,
  };
}

function toMs(local: string): number | null {
  if (!local.trim()) return null;
  const ms = new Date(ukDateTimeLocalToIso(local)).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function AssignShiftFromSiteForm({ siteId, guards, isAdmin }: AssignShiftFromSiteFormProps) {
  const router = useRouter();
  const [rows, setRows] = useState<ShiftRow[]>(() => [newRow()]);
  const [force, setForce] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (guards.length === 0) {
    return <p className="text-sm text-[var(--portal-text-muted)]">No guards are trained for this site yet.</p>;
  }

  function updateRow(key: string, patch: Partial<ShiftRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function priorDutiesForRow(rowIndex: number, userId: number | null): GuardDutyWindow[] {
    if (userId == null) return [];
    const prior: GuardDutyWindow[] = [];
    for (let i = 0; i < rowIndex; i += 1) {
      const r = rows[i];
      if (r.userId !== userId || !r.startsAt.trim() || !r.endsAt.trim()) continue;
      prior.push({
        startsAt: ukDateTimeLocalToIso(r.startsAt),
        endsAt: ukDateTimeLocalToIso(r.endsAt),
        status: "scheduled",
      });
    }
    return prior;
  }

  const rowOk = rows.map((row, index) => {
    const startMs = toMs(row.startsAt);
    const endMs = toMs(row.endsAt);
    if (row.userId == null || startMs == null || !row.endsAt.trim()) return false;
    const guard = guards.find((g) => g.userId === row.userId);
    if (!guard) return false;
    const status = availabilityForProposedStart(
      guard.availability,
      startMs,
      endMs,
      priorDutiesForRow(index, row.userId),
    );
    return status.canAssign || (isAdmin && force);
  });

  const canSubmit = rows.every((_, i) => rowOk[i]) && !saving;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    const fd = new FormData();
    fd.set("siteId", String(siteId));
    if (force) fd.set("force", "1");
    rows.forEach((row, i) => {
      fd.set(`shift_${i}_userId`, String(row.userId));
      fd.set(`shift_${i}_startsAt`, row.startsAt);
      fd.set(`shift_${i}_endsAt`, row.endsAt);
    });
    fd.set("shiftCount", String(rows.length));
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await assignMultipleSiteShiftsAction(fd);
      if (result.ok) {
        setSuccess(result.message);
        setRows([newRow()]);
        setForce(false);
      } else {
        setError(result.message);
        // Drop the rows that were written so a retry cannot duplicate them.
        if (result.failedRows?.length) {
          const keep = new Set(result.failedRows);
          setRows((prev) => prev.filter((_, i) => keep.has(i)));
        }
        if (result.sessionExpired) goToLogin();
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save shifts.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DutyScheduleHint />
      <ActionFeedback success={success} error={error} />

      {rows.map((row, index) => {
        const startMs = toMs(row.startsAt);
        const endMs = toMs(row.endsAt);
        const prior = priorDutiesForRow(index, row.userId);
        const selected = row.userId != null ? guards.find((g) => g.userId === row.userId) : null;
        const selectedStatus =
          selected != null
            ? availabilityForProposedStart(selected.availability, startMs, endMs, prior)
            : null;

        return (
          <div key={row.key} className="space-y-3 rounded-xl border border-[var(--portal-border)] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">
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
              <label className="block text-sm text-[var(--portal-text-muted)]">
                Start (UK)
                <input
                  type="datetime-local"
                  required
                  value={row.startsAt}
                  onChange={(e) => updateRow(row.key, { startsAt: e.target.value, userId: null })}
                  className="mt-1 w-full lunar-input"
                />
              </label>
              <label className="block text-sm text-[var(--portal-text-muted)]">
                End (UK)
                <input
                  type="datetime-local"
                  required
                  value={row.endsAt}
                  onChange={(e) => updateRow(row.key, { endsAt: e.target.value, userId: null })}
                  className="mt-1 w-full lunar-input"
                />
              </label>
            </div>
            <UkDateTimeHint />

            <div>
              <p className="text-sm font-medium text-[var(--portal-text)]">
                Guard (trained &amp; free for this start)
              </p>
              <SearchableGuardPicker
                guards={guards.map((g) => ({
                  ...g,
                  availability: {
                    ...g.availability,
                    duties: [...(g.availability.duties ?? []), ...priorDutiesForRow(index, g.userId)],
                  },
                }))}
                value={row.userId}
                onChange={(userId) => updateRow(row.key, { userId })}
                proposedStartMs={startMs}
                proposedEndMs={endMs}
                allowUnavailable={isAdmin && force}
                emptyMessage="No trained guards match your search."
              />
            </div>

            {selectedStatus && startMs != null && !selectedStatus.canAssign ? (
              <p className="text-xs text-amber-800">
                Not free ({selectedStatus.label}). Need {GUARD_RECHARGE_HOURS}h after prior duty (completed or
                scheduled), including earlier rows for the same guard.
              </p>
            ) : null}
          </div>
        );
      })}

      <button
        type="button"
        className="lunar-btn-secondary lunar-btn-sm"
        onClick={() => setRows((prev) => [...prev, newRow()])}
      >
        Add another shift
      </button>

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
              Bypass one-duty-per-day and {GUARD_RECHARGE_HOURS}-hour recharge.
            </span>
          </span>
        </label>
      ) : null}

      <button type="submit" className="lunar-btn-primary w-full sm:w-auto" disabled={!canSubmit}>
        {saving
          ? "Saving…"
          : rows.length > 1
            ? `Save ${rows.length} shifts`
            : "Assign guard to site"}
      </button>
    </form>
  );
}
