"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { UkDateTimeHint } from "@/components/forms/uk-datetime-hint";
import {
  availabilityForProposedStart,
  GUARD_RECHARGE_HOURS,
  type GuardAvailabilityInfo,
} from "@/lib/guard-availability";
import { ukDateTimeLocalToIso } from "@/lib/uk-datetime";

export type SiteOption = { id: number; name: string };

export type GuardPickerOption = {
  userId: number;
  name: string;
  availability: GuardAvailabilityInfo;
};

type PickerContextValue = {
  sites: SiteOption[];
  siteId: string;
  setSiteId: (id: string) => void;
  guardId: string;
  setGuardId: (id: string) => void;
  startsAt: string;
  setStartsAt: (v: string) => void;
  endsAt: string;
  setEndsAt: (v: string) => void;
  proposedStartMs: number | null;
  proposedEndMs: number | null;
  guardsForSite: GuardPickerOption[];
  trainingBySite: Record<string, number[]>;
  siteFieldName: string;
  guardFieldName: string;
  showSiteIdSuffix: boolean;
  allowUnavailable: boolean;
};

const PickerContext = createContext<PickerContextValue | null>(null);

function usePickerContext() {
  const ctx = useContext(PickerContext);
  if (!ctx) throw new Error("TrainedSiteGuardPicker components must be used within TrainedSiteGuardPickerProvider");
  return ctx;
}

function parseProposedStartMs(startsAtLocal: string): number | null {
  if (!startsAtLocal?.trim()) return null;
  const ms = new Date(ukDateTimeLocalToIso(startsAtLocal)).getTime();
  return Number.isNaN(ms) ? null : ms;
}

type TrainedSiteGuardPickerProviderProps = {
  sites: SiteOption[];
  guards: GuardPickerOption[];
  trainingBySite: Record<string, number[]>;
  siteFieldName?: string;
  guardFieldName?: string;
  defaultSiteId?: number;
  defaultGuardId?: number;
  defaultStartsAt?: string;
  defaultEndsAt?: string;
  showSiteIdSuffix?: boolean;
  /** When true (e.g. admin force), unavailable guards stay selectable. */
  allowUnavailable?: boolean;
  children: ReactNode;
};

export function TrainedSiteGuardPickerProvider({
  sites,
  guards,
  trainingBySite,
  siteFieldName = "siteId",
  guardFieldName = "userId",
  defaultSiteId,
  defaultGuardId,
  defaultStartsAt = "",
  defaultEndsAt = "",
  showSiteIdSuffix = true,
  allowUnavailable = false,
  children,
}: TrainedSiteGuardPickerProviderProps) {
  const [siteId, setSiteId] = useState(defaultSiteId ? String(defaultSiteId) : "");
  const [guardId, setGuardId] = useState(defaultGuardId ? String(defaultGuardId) : "");
  const [startsAt, setStartsAt] = useState(defaultStartsAt);
  const [endsAt, setEndsAt] = useState(defaultEndsAt);

  const proposedStartMs = useMemo(() => parseProposedStartMs(startsAt), [startsAt]);
  const proposedEndMs = useMemo(() => parseProposedStartMs(endsAt), [endsAt]);

  const trainedUserIds = useMemo(() => {
    if (!siteId) return new Set<number>();
    return new Set(trainingBySite[siteId] ?? []);
  }, [siteId, trainingBySite]);

  const guardsForSite = useMemo(
    () => guards.filter((g) => trainedUserIds.has(g.userId)),
    [guards, trainedUserIds],
  );

  function onSiteChange(nextSiteId: string) {
    setSiteId(nextSiteId);
    const nextTrained = new Set(trainingBySite[nextSiteId] ?? []);
    if (guardId && !nextTrained.has(Number(guardId))) {
      setGuardId("");
    }
  }

  function onStartsAtChange(next: string) {
    setStartsAt(next);
    if (!guardId) return;
    const nextMs = parseProposedStartMs(next);
    const selected = guardsForSite.find((g) => String(g.userId) === guardId);
    if (!selected) return;
    const status = availabilityForProposedStart(selected.availability, nextMs, parseProposedStartMs(endsAt));
    if (!status.canAssign && !allowUnavailable) {
      setGuardId("");
    }
  }

  function onEndsAtChange(next: string) {
    setEndsAt(next);
    if (!guardId) return;
    const selected = guardsForSite.find((g) => String(g.userId) === guardId);
    if (!selected) return;
    const status = availabilityForProposedStart(
      selected.availability,
      parseProposedStartMs(startsAt),
      parseProposedStartMs(next),
    );
    if (!status.canAssign && !allowUnavailable) {
      setGuardId("");
    }
  }

  const guardStillValid = guardsForSite.some((g) => String(g.userId) === guardId);
  const value: PickerContextValue = {
    sites,
    siteId,
    setSiteId: onSiteChange,
    guardId: guardStillValid ? guardId : "",
    setGuardId,
    startsAt,
    setStartsAt: onStartsAtChange,
    endsAt,
    setEndsAt: onEndsAtChange,
    proposedStartMs,
    proposedEndMs,
    guardsForSite,
    trainingBySite,
    siteFieldName,
    guardFieldName,
    showSiteIdSuffix,
    allowUnavailable,
  };

  return <PickerContext.Provider value={value}>{children}</PickerContext.Provider>;
}

type FieldProps = {
  className?: string;
  form?: string;
};

export function TrainedSiteSelectField({ className, form }: FieldProps) {
  const { sites, siteId, setSiteId, siteFieldName, showSiteIdSuffix, trainingBySite } = usePickerContext();
  const options = useMemo(
    () =>
      sites.map((site) => {
        const trainedCount = trainingBySite[String(site.id)]?.length ?? 0;
        const label = showSiteIdSuffix
          ? `(${trainedCount}) ${site.name} (#${site.id})`
          : `(${trainedCount}) ${site.name}`;
        return { value: String(site.id), label };
      }),
    [sites, trainingBySite, showSiteIdSuffix],
  );

  return (
    <SearchableSelect
      name={siteFieldName}
      form={form}
      options={options}
      value={siteId}
      onChange={setSiteId}
      required
      placeholder="Select site"
      searchPlaceholder="Search sites…"
      className={className}
    />
  );
}

export function TrainedShiftTimeFields({
  className,
  form,
  startClassName = "mt-1 lunar-input",
  endClassName = "mt-1 lunar-input",
}: FieldProps & { startClassName?: string; endClassName?: string }) {
  const { siteId, startsAt, setStartsAt, endsAt, setEndsAt } = usePickerContext();
  return (
    <div className={className ?? "space-y-2"}>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-semibold text-[var(--portal-text-muted)]">
          Start (UK)
          <input
            form={form}
            name="startsAt"
            type="datetime-local"
            required
            disabled={!siteId}
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className={startClassName}
          />
        </label>
        <label className="text-xs font-semibold text-[var(--portal-text-muted)]">
          End (UK)
          <input
            form={form}
            name="endsAt"
            type="datetime-local"
            required
            disabled={!siteId}
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className={endClassName}
          />
        </label>
      </div>
      <UkDateTimeHint />
      {!siteId ? (
        <p className="text-xs text-[var(--portal-text-muted)]">Select a site before setting times.</p>
      ) : null}
    </div>
  );
}

export function TrainedGuardSelectField({ className = "lunar-input", form }: FieldProps) {
  const {
    siteId,
    guardId,
    setGuardId,
    guardsForSite,
    guardFieldName,
    proposedStartMs,
    proposedEndMs,
    allowUnavailable,
  } = usePickerContext();

  const ranked = useMemo(() => {
    return [...guardsForSite]
      .map((guard) => {
        const status = availabilityForProposedStart(guard.availability, proposedStartMs, proposedEndMs);
        return { guard, status };
      })
      .sort((a, b) => {
        if (a.status.canAssign !== b.status.canAssign) return a.status.canAssign ? -1 : 1;
        return a.guard.name.localeCompare(b.guard.name, undefined, { sensitivity: "base" });
      });
  }, [guardsForSite, proposedStartMs, proposedEndMs]);

  const timesReady = proposedStartMs != null;
  const assignableCount = ranked.filter((r) => r.status.canAssign).length;

  return (
    <>
      <select
        form={form}
        name={guardFieldName}
        required
        className={className}
        value={guardId}
        onChange={(e) => setGuardId(e.target.value)}
        disabled={!siteId || !timesReady}
      >
        <option value="" disabled>
          {!siteId
            ? "Select a site first"
            : !timesReady
              ? "Set start time first"
              : guardsForSite.length === 0
                ? "No trained guards"
                : "Select guard (trained & free for this start)"}
        </option>
        {ranked.map(({ guard, status }) => {
          const disabled = !status.canAssign && !allowUnavailable;
          return (
            <option key={guard.userId} value={guard.userId} disabled={disabled}>
              {guard.name} — {status.label}
            </option>
          );
        })}
      </select>
      {siteId && timesReady && guardsForSite.length === 0 ? (
        <p className="mt-1 text-xs text-amber-800">
          No guards trained here.{" "}
          <a href="/manager/training" className="font-semibold underline">
            Add training
          </a>
        </p>
      ) : null}
      {siteId && timesReady && guardsForSite.length > 0 && assignableCount === 0 ? (
        <p className="mt-1 text-xs text-amber-800">
          No trained guards are free at this start (need {GUARD_RECHARGE_HOURS}h rest after last duty, or
          another duty conflict). Adjust the start time or pick a different site.
        </p>
      ) : null}
    </>
  );
}

/** Site → start/end times → trained guards filtered for that start. */
export function TrainedSiteGuardPicker(
  props: Omit<TrainedSiteGuardPickerProviderProps, "children"> & {
    siteSelectClassName?: string;
    guardSelectClassName?: string;
  },
) {
  const { siteSelectClassName, guardSelectClassName, ...providerProps } = props;
  return (
    <TrainedSiteGuardPickerProvider {...providerProps}>
      <div className="space-y-3">
        <TrainedSiteSelectField className={siteSelectClassName} />
        <TrainedShiftTimeFields />
        <TrainedGuardSelectField className={guardSelectClassName} />
      </div>
    </TrainedSiteGuardPickerProvider>
  );
}
