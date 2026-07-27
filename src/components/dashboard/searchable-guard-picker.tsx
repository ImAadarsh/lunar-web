"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { GuardAvailabilityBadge } from "@/components/portal/guard-availability-badge";
import {
  availabilityForProposedStart,
  GUARD_RECHARGE_HOURS,
  type GuardAvailabilityInfo,
} from "@/lib/guard-availability";
import { formatUkDateTime } from "@/lib/format-datetime";

export type SearchableGuardOption = {
  userId: number;
  label: string;
  availability: GuardAvailabilityInfo;
};

type SearchableGuardPickerProps = {
  guards: SearchableGuardOption[];
  value: number | null;
  onChange: (userId: number | null) => void;
  /** Proposed shift start (UTC ms). When null, guards cannot be selected yet. */
  proposedStartMs?: number | null;
  proposedEndMs?: number | null;
  /** Admin force — allow picking guards who fail recharge/duty checks. */
  allowUnavailable?: boolean;
  emptyMessage?: string;
};

export function SearchableGuardPicker({
  guards,
  value,
  onChange,
  proposedStartMs = null,
  proposedEndMs = null,
  allowUnavailable = false,
  emptyMessage = "No guards match your search.",
}: SearchableGuardPickerProps) {
  const [search, setSearch] = useState("");

  const ranked = useMemo(() => {
    return [...guards]
      .map((g) => ({
        guard: g,
        status: availabilityForProposedStart(g.availability, proposedStartMs, proposedEndMs),
      }))
      .sort((a, b) => {
        if (a.status.canAssign !== b.status.canAssign) return a.status.canAssign ? -1 : 1;
        return a.guard.label.localeCompare(b.guard.label, undefined, { sensitivity: "base" });
      });
  }, [guards, proposedStartMs, proposedEndMs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ranked;
    return ranked.filter((r) => r.guard.label.toLowerCase().includes(q));
  }, [ranked, search]);

  const selected = value != null ? guards.find((g) => g.userId === value) : null;
  const selectedStatus =
    selected != null
      ? availabilityForProposedStart(selected.availability, proposedStartMs, proposedEndMs)
      : null;

  if (proposedStartMs == null) {
    return (
      <p className="mt-2 rounded-lg border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-3 py-4 text-sm text-[var(--portal-text-muted)]">
        Set the shift start time first — guards are listed by who is free after a{" "}
        {GUARD_RECHARGE_HOURS}-hour rest from their last duty.
      </p>
    );
  }

  if (selected) {
    return (
      <div className="mt-2 space-y-2">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--portal-accent)]/35 bg-[var(--portal-accent)]/15 px-3 py-2.5">
          <p className="min-w-0 flex-1 text-sm font-semibold text-[var(--portal-text)]">{selected.label}</p>
          <span className="text-xs font-medium text-[var(--portal-text-muted)]">{selectedStatus?.label}</span>
          <GuardAvailabilityBadge info={selected.availability} />
          <button
            type="button"
            className="text-xs font-semibold text-[var(--portal-link)] hover:underline"
            onClick={() => {
              setSearch("");
              onChange(null);
            }}
          >
            Change
          </button>
        </div>
        {selectedStatus && !selectedStatus.canAssign && selectedStatus.rechargingUntil ? (
          <p className="text-xs text-amber-800">
            Earliest start after rest: {formatUkDateTime(selectedStatus.rechargingUntil)}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email…"
        className="lunar-input-sm w-full"
        aria-label="Search guards"
        autoComplete="off"
      />
      <div className="max-h-52 min-h-[9rem] overflow-y-auto rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-[var(--portal-text-muted)]">{emptyMessage}</p>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map(({ guard, status }) => {
              const canPick = status.canAssign || allowUnavailable;
              return (
                <li key={guard.userId}>
                  <button
                    type="button"
                    disabled={!canPick}
                    onClick={() => onChange(guard.userId)}
                    className={cn(
                      "flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                      canPick
                        ? "text-[var(--portal-text)] hover:bg-[var(--portal-table-row-hover)]"
                        : "cursor-not-allowed opacity-60",
                    )}
                  >
                    <span className="min-w-0 flex-1 leading-snug">{guard.label}</span>
                    <span className="shrink-0 text-xs font-medium text-[var(--portal-text-muted)]">
                      {status.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="text-xs text-[var(--portal-text-muted)]">
        Free for this start first. Recharge is {GUARD_RECHARGE_HOURS}h after the previous duty ends.
      </p>
    </div>
  );
}
