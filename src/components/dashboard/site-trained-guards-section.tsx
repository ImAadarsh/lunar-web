"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GuardAvailabilityBadge } from "@/components/portal/guard-availability-badge";
import { StatusBadge } from "@/components/portal/status-badge";
import { ModalPortal, useBodyScrollLock } from "@/components/ui/modal-portal";
import { AvailabilityFilterChips } from "@/components/dashboard/availability-filter-chips";
import {
  addSiteTrainingAction,
  assignGuardAtSiteAction,
  removeSiteTrainingAction,
  updateSiteTrainingAction,
} from "@/lib/site-dashboard-actions";
import { formatHours } from "@/lib/dashboard-api";
import { formatUkTrainedOn } from "@/lib/format-datetime";
import { guardAvailabilityLabel, type GuardAvailabilityInfo } from "@/lib/guard-availability";
import { cn } from "@/lib/cn";

export type SiteTrainedGuardRow = {
  trainingId: number;
  userId: number;
  userEmail: string;
  guardName?: string | null;
  userStatus: string;
  trainedOn?: string | null;
  dutyHoursInPeriod?: number;
  availability: GuardAvailabilityInfo;
};

type GuardOption = { id: number; label: string };

type SiteTrainedGuardsSectionProps = {
  siteId: number;
  guards: SiteTrainedGuardRow[];
  untrainedGuardOptions: GuardOption[];
  rosterCounts: Record<string, number>;
  periodLabel: string;
  isAdmin: boolean;
};

type AssignTarget = {
  userId: number;
  label: string;
  canAssign: boolean;
};

function DialogShell({
  open,
  onClose,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <ModalPortal>
      <div
        className="portal-modal-backdrop fixed inset-0 z-[200] flex items-end justify-center p-0 backdrop-blur-md sm:items-center sm:p-4"
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="site-dialog-title"
          className={cn(
            "portal-theme-panel flex max-h-[min(92dvh,720px)] w-full flex-col overflow-hidden rounded-t-2xl border shadow-xl sm:rounded-2xl",
            wide ? "sm:max-w-xl" : "sm:max-w-lg",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-[var(--portal-border)] px-4 py-4 sm:px-5">
            <div>
              <h2 id="site-dialog-title" className="font-display text-lg font-semibold text-[var(--portal-text)]">
                {title}
              </h2>
              {description ? <p className="portal-section-muted mt-0.5">{description}</p> : null}
            </div>
            <button type="button" onClick={onClose} className="lunar-btn-ghost lunar-btn-sm shrink-0" aria-label="Close">
              ×
            </button>
          </div>
          <div className="overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        </div>
      </div>
    </ModalPortal>
  );
}

export function SiteTrainedGuardsSection({
  siteId,
  guards,
  untrainedGuardOptions,
  rosterCounts,
  periodLabel,
  isAdmin,
}: SiteTrainedGuardsSectionProps) {
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [editTraining, setEditTraining] = useState<{
    trainingId: number;
    userId: number;
    label: string;
    trainedOn: string;
  } | null>(null);

  const closeAssign = useCallback(() => setAssignTarget(null), []);

  const filteredUntrained = useMemo(() => {
    const q = addSearch.trim().toLowerCase();
    if (!q) return untrainedGuardOptions;
    return untrainedGuardOptions.filter((g) => g.label.toLowerCase().includes(q));
  }, [untrainedGuardOptions, addSearch]);

  const filteredGuards = useMemo(() => {
    if (availabilityFilter === "all") return guards;
    return guards.filter((g) => g.availability.state === availabilityFilter);
  }, [guards, availabilityFilter]);

  const dutyHoursHeader = `Duty hours (${periodLabel})`;

  return (
    <>
      <section className="lunar-card lunar-card-pad flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="portal-section-title">Trained guards</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              Click an assignable row to schedule a shift. Filter by availability or manage training below.
            </p>
          </div>
          {isAdmin ? (
            <button
              type="button"
              className="lunar-btn-primary lunar-btn-sm shrink-0"
              onClick={() => {
                setAddSearch("");
                setAddOpen(true);
              }}
            >
              Add guards
            </button>
          ) : null}
        </div>

        {Object.keys(rosterCounts).length > 0 ? (
          <div className="mt-3">
            <AvailabilityFilterChips
              counts={rosterCounts}
              value={availabilityFilter}
              onChange={setAvailabilityFilter}
            />
          </div>
        ) : null}

        <div className="lunar-table-wrap mt-3 min-h-0 flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Guard</th>
                <th className="px-3 py-2">Trained on</th>
                <th className="px-3 py-2">{dutyHoursHeader}</th>
                <th className="px-3 py-2">Account</th>
                <th className="px-3 py-2">Availability</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredGuards.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    {guards.length === 0
                      ? isAdmin
                        ? "No trained guards yet. Use Add guards to train staff for this site."
                        : "No trained guards yet."
                      : "No guards match this availability filter."}
                  </td>
                </tr>
              ) : null}
              {filteredGuards.map((guard) => {
                const label = guard.guardName ?? guard.userEmail;
                const canAssign = guard.availability.canAssign;
                return (
                  <tr
                    key={guard.trainingId}
                    className={cn(
                      "border-t border-slate-100 align-top",
                      canAssign ? "cursor-pointer hover:bg-lunar-50/60" : "hover:bg-slate-50/50",
                    )}
                    onClick={() => {
                      if (!canAssign) return;
                      setAssignTarget({ userId: guard.userId, label, canAssign });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canAssign) {
                        setAssignTarget({ userId: guard.userId, label, canAssign });
                      }
                    }}
                    tabIndex={canAssign ? 0 : undefined}
                    role={canAssign ? "button" : undefined}
                    title={canAssign ? "Click to assign a shift" : guardAvailabilityLabel(guard.availability.state)}
                  >
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/manager/guards/${guard.userId}`}
                        className="font-medium text-lunar-800 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {label}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{formatUkTrainedOn(guard.trainedOn)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-700">
                      {formatHours(guard.dutyHoursInPeriod ?? 0)}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={guard.userStatus} />
                    </td>
                    <td className="px-3 py-2.5">
                      <GuardAvailabilityBadge info={guard.availability} showDetail />
                    </td>
                    <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {isAdmin ? (
                          <>
                            <button
                              type="button"
                              className="lunar-btn-secondary lunar-btn-sm"
                              onClick={() =>
                                setEditTraining({
                                  trainingId: guard.trainingId,
                                  userId: guard.userId,
                                  label,
                                  trainedOn: guard.trainedOn?.slice(0, 10) ?? "",
                                })
                              }
                            >
                              Edit
                            </button>
                            <form action={removeSiteTrainingAction}>
                              <input type="hidden" name="siteId" value={String(siteId)} />
                              <input type="hidden" name="trainingId" value={String(guard.trainingId)} />
                              <input type="hidden" name="userId" value={String(guard.userId)} />
                              <button
                                type="submit"
                                className="lunar-btn-danger lunar-btn-sm"
                                onClick={(e) => {
                                  if (!window.confirm(`Remove training for ${label} at this site?`)) {
                                    e.preventDefault();
                                  }
                                }}
                              >
                                Remove
                              </button>
                            </form>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <DialogShell
        open={assignTarget != null}
        onClose={closeAssign}
        title="Assign shift"
        description={
          assignTarget
            ? `${assignTarget.label} · ${assignTarget.canAssign ? "Set start and end time for this site." : "Not assignable right now."}`
            : undefined
        }
      >
        {assignTarget ? (
          <form action={assignGuardAtSiteAction} className="space-y-3">
            <input type="hidden" name="siteId" value={String(siteId)} />
            <input type="hidden" name="userId" value={String(assignTarget.userId)} />
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
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="lunar-btn-secondary" onClick={closeAssign}>
                Cancel
              </button>
              <button type="submit" className="lunar-btn-primary">
                Assign shift
              </button>
            </div>
          </form>
        ) : null}
      </DialogShell>

      <DialogShell
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add trained guards"
        description="Select guards who are not yet trained on this site."
        wide
      >
        {untrainedGuardOptions.length === 0 ? (
          <p className="text-sm text-slate-500">Every active guard is already trained for this site.</p>
        ) : (
          <form action={addSiteTrainingAction} className="space-y-4">
            <input type="hidden" name="siteId" value={String(siteId)} />
            <label className="block text-sm text-slate-600">
              Trained on
              <input name="trainedOn" type="date" className="mt-1 w-full lunar-input" />
            </label>
            <label className="block text-sm text-slate-600">
              Search guards
              <input
                type="search"
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                placeholder="Name or email…"
                className="mt-1 w-full lunar-input"
                autoComplete="off"
              />
            </label>
            <fieldset className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Guards {filteredUntrained.length < untrainedGuardOptions.length
                  ? `(${filteredUntrained.length} of ${untrainedGuardOptions.length})`
                  : `(${filteredUntrained.length})`}
              </legend>
              {filteredUntrained.length === 0 ? (
                <p className="text-sm text-slate-500">No guards match your search.</p>
              ) : null}
              {filteredUntrained.map((g) => (
                <label key={g.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                  <input type="checkbox" name="userIds" value={String(g.id)} className="rounded border-slate-300" />
                  {g.label}
                </label>
              ))}
            </fieldset>
            <div className="flex justify-end gap-2">
              <button type="button" className="lunar-btn-secondary" onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="lunar-btn-primary" disabled={filteredUntrained.length === 0}>
                Add to site
              </button>
            </div>
          </form>
        )}
      </DialogShell>

      <DialogShell
        open={editTraining != null}
        onClose={() => setEditTraining(null)}
        title="Edit training"
        description={editTraining ? editTraining.label : undefined}
      >
        {editTraining ? (
          <form action={updateSiteTrainingAction} className="space-y-4">
            <input type="hidden" name="siteId" value={String(siteId)} />
            <input type="hidden" name="trainingId" value={String(editTraining.trainingId)} />
            <input type="hidden" name="userId" value={String(editTraining.userId)} />
            <label className="block text-sm text-slate-600">
              Trained on
              <input
                name="trainedOn"
                type="date"
                defaultValue={editTraining.trainedOn}
                className="mt-1 w-full lunar-input"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="lunar-btn-secondary" onClick={() => setEditTraining(null)}>
                Cancel
              </button>
              <button type="submit" className="lunar-btn-primary">
                Save
              </button>
            </div>
          </form>
        ) : null}
      </DialogShell>
    </>
  );
}
