"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { guardAvailabilityLabel, type GuardAvailabilityInfo } from "@/lib/guard-availability";

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
  guardsForSite: GuardPickerOption[];
  trainingBySite: Record<string, number[]>;
  siteFieldName: string;
  guardFieldName: string;
  showSiteIdSuffix: boolean;
};

const PickerContext = createContext<PickerContextValue | null>(null);

function usePickerContext() {
  const ctx = useContext(PickerContext);
  if (!ctx) throw new Error("TrainedSiteGuardPicker components must be used within TrainedSiteGuardPickerProvider");
  return ctx;
}

type TrainedSiteGuardPickerProviderProps = {
  sites: SiteOption[];
  guards: GuardPickerOption[];
  trainingBySite: Record<string, number[]>;
  siteFieldName?: string;
  guardFieldName?: string;
  defaultSiteId?: number;
  defaultGuardId?: number;
  showSiteIdSuffix?: boolean;
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
  showSiteIdSuffix = true,
  children,
}: TrainedSiteGuardPickerProviderProps) {
  const [siteId, setSiteId] = useState(defaultSiteId ? String(defaultSiteId) : "");
  const [guardId, setGuardId] = useState(defaultGuardId ? String(defaultGuardId) : "");

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

  const guardStillValid = guardsForSite.some((g) => String(g.userId) === guardId);
  const value: PickerContextValue = {
    sites,
    siteId,
    setSiteId: onSiteChange,
    guardId: guardStillValid ? guardId : "",
    setGuardId,
    guardsForSite,
    trainingBySite,
    siteFieldName,
    guardFieldName,
    showSiteIdSuffix,
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

export function TrainedGuardSelectField({ className = "lunar-input", form }: FieldProps) {
  const { siteId, guardId, setGuardId, guardsForSite, guardFieldName } = usePickerContext();
  return (
  <>
    <select
      form={form}
      name={guardFieldName}
      required
      className={className}
      value={guardId}
      onChange={(e) => setGuardId(e.target.value)}
      disabled={!siteId}
    >
      <option value="" disabled>
        {!siteId
          ? "Select a site first"
          : guardsForSite.length === 0
            ? "No trained guards"
            : "Select guard (trained on site)"}
      </option>
      {guardsForSite.map((guard) => (
        <option key={guard.userId} value={guard.userId} disabled={!guard.availability.canAssign}>
          {guard.name} — {guardAvailabilityLabel(guard.availability.state)}
        </option>
      ))}
    </select>
    {siteId && guardsForSite.length === 0 ? (
      <p className="mt-1 text-xs text-amber-800">
        No guards trained here.{" "}
        <a href="/manager/training" className="font-semibold underline">
          Add training
        </a>
      </p>
    ) : null}
  </>
  );
}

/** Stacked site + guard selects (assign shift modal). */
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
        <TrainedGuardSelectField className={guardSelectClassName} />
      </div>
    </TrainedSiteGuardPickerProvider>
  );
}
