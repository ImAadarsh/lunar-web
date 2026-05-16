"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/cn";

export type AssignTrainingOption = {
  id: number;
  label: string;
};

type AssignTrainingFormProps = {
  guards: AssignTrainingOption[];
  sites: AssignTrainingOption[];
  assignAction: (formData: FormData) => Promise<void>;
};

function MultiSelectPanel({
  title,
  options,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  search,
  onSearchChange,
  emptyMessage,
}: {
  title: string;
  options: AssignTrainingOption[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onSelectAll: () => void;
  onClear: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  emptyMessage: string;
}) {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">
          {title}{" "}
          <span className="font-normal text-slate-500">({selected.size} selected)</span>
        </p>
        <div className="flex gap-1 text-xs">
          <button type="button" onClick={onSelectAll} className="text-lunar-700 hover:underline">
            All
          </button>
          <span className="text-slate-300">|</span>
          <button type="button" onClick={onClear} className="text-slate-600 hover:underline">
            Clear
          </button>
        </div>
      </div>
      <input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={`Search ${title.toLowerCase()}…`}
        className="mt-2 lunar-input-sm"
        aria-label={`Search ${title.toLowerCase()}`}
      />
      <div className="mt-2 max-h-48 min-h-[8rem] flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2">
        {options.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-slate-500">{emptyMessage}</p>
        ) : (
          <ul className="space-y-0.5">
            {options.map((opt) => {
              const checked = selected.has(opt.id);
              return (
                <li key={opt.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      checked ? "bg-lunar-50 text-lunar-900" : "hover:bg-white"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(opt.id)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-lunar-700 focus:ring-lunar-400/30"
                    />
                    <span className="leading-snug">{opt.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export function AssignTrainingForm({ guards, sites, assignAction }: AssignTrainingFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [guardSearch, setGuardSearch] = useState("");
  const [siteSearch, setSiteSearch] = useState("");
  const [selectedGuards, setSelectedGuards] = useState<Set<number>>(() => new Set());
  const [selectedSites, setSelectedSites] = useState<Set<number>>(() => new Set());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const filteredGuards = useMemo(() => {
    const q = guardSearch.trim().toLowerCase();
    if (!q) return guards;
    return guards.filter((g) => g.label.toLowerCase().includes(q));
  }, [guards, guardSearch]);

  const filteredSites = useMemo(() => {
    const q = siteSearch.trim().toLowerCase();
    if (!q) return sites;
    return sites.filter((s) => s.label.toLowerCase().includes(q));
  }, [sites, siteSearch]);

  const pairCount = selectedGuards.size * selectedSites.size;

  function toggleGuard(id: number) {
    setSelectedGuards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSite(id: number) {
    setSelectedSites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (selectedGuards.size === 0 || selectedSites.size === 0) {
      setError("Select at least one guard and one site.");
      return;
    }
    const formData = new FormData(e.currentTarget);
    selectedGuards.forEach((id) => formData.append("userIds", String(id)));
    selectedSites.forEach((id) => formData.append("siteIds", String(id)));
    startTransition(async () => {
      try {
        await assignAction(formData);
        setSuccess(
          pairCount === 1
            ? "Assignment saved."
            : `Saved assignments (duplicates skipped).`
        );
        setSelectedGuards(new Set());
        setSelectedSites(new Set());
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save assignments.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <MultiSelectPanel
          title="Guards"
          options={filteredGuards}
          selected={selectedGuards}
          onToggle={toggleGuard}
          onSelectAll={() => setSelectedGuards(new Set(guards.map((g) => g.id)))}
          onClear={() => setSelectedGuards(new Set())}
          search={guardSearch}
          onSearchChange={setGuardSearch}
          emptyMessage="No guards match your search."
        />
        <MultiSelectPanel
          title="Sites"
          options={filteredSites}
          selected={selectedSites}
          onToggle={toggleSite}
          onSelectAll={() => setSelectedSites(new Set(sites.map((s) => s.id)))}
          onClear={() => setSelectedSites(new Set())}
          search={siteSearch}
          onSearchChange={setSiteSearch}
          emptyMessage="No sites match your search."
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-slate-600">
          Trained on
          <input name="trainedOn" type="date" className="mt-1 w-full lunar-input" />
        </label>
        <label className="block text-sm text-slate-600">
          Notes
          <input name="notes" placeholder="Optional" className="mt-1 w-full lunar-input" />
        </label>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
      {success ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </p>
      ) : null}

      <p className="text-xs text-slate-500">
        {pairCount > 0
          ? `Creates one assignment per guard–site pair (${pairCount} total). Existing pairs are skipped.`
          : "Select guards and sites to see how many assignments will be created."}
      </p>

      <button
        type="submit"
        disabled={pending || selectedGuards.size === 0 || selectedSites.size === 0}
        className="lunar-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending
          ? "Saving…"
          : pairCount > 0
            ? `Save ${pairCount} assignment${pairCount === 1 ? "" : "s"}`
            : "Save assignments"}
      </button>
    </form>
  );
}
