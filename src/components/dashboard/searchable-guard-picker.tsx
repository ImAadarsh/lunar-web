"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { GuardAvailabilityBadge } from "@/components/portal/guard-availability-badge";
import { guardAvailabilityLabel, type GuardAvailabilityInfo } from "@/lib/guard-availability";

export type SearchableGuardOption = {
  userId: number;
  label: string;
  availability: GuardAvailabilityInfo;
};

type SearchableGuardPickerProps = {
  guards: SearchableGuardOption[];
  value: number | null;
  onChange: (userId: number | null) => void;
  emptyMessage?: string;
};

export function SearchableGuardPicker({
  guards,
  value,
  onChange,
  emptyMessage = "No guards match your search.",
}: SearchableGuardPickerProps) {
  const [search, setSearch] = useState("");

  const sorted = useMemo(
    () =>
      [...guards].sort((a, b) => {
        if (a.availability.canAssign !== b.availability.canAssign) {
          return a.availability.canAssign ? -1 : 1;
        }
        return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
      }),
    [guards],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((g) => g.label.toLowerCase().includes(q));
  }, [sorted, search]);

  const selected = value != null ? guards.find((g) => g.userId === value) : null;

  if (selected) {
    return (
      <div className="mt-2 space-y-2">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--portal-accent)]/35 bg-[var(--portal-accent)]/15 px-3 py-2.5">
          <p className="min-w-0 flex-1 text-sm font-semibold text-[var(--portal-text)]">{selected.label}</p>
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
            {filtered.map((guard) => {
              const canPick = guard.availability.canAssign;
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
                      {guardAvailabilityLabel(guard.availability.state)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="text-xs text-[var(--portal-text-muted)]">
        Assignable guards appear first. Unavailable guards are listed but cannot be selected.
      </p>
    </div>
  );
}
