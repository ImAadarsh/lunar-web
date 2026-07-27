/** Guard duty availability — synced with backend guardDutyService.js */

/** Rest hours after duty end before next start. Override with NEXT_PUBLIC_GUARD_RECHARGE_HOURS. */
export const GUARD_RECHARGE_HOURS = Math.max(
  0,
  Number(process.env.NEXT_PUBLIC_GUARD_RECHARGE_HOURS ?? "8") || 8,
);
export const GUARD_RECHARGE_MS = GUARD_RECHARGE_HOURS * 60 * 60 * 1000;
export const DUTY_TIMEZONE = "Europe/London";

/** Duty day = UK calendar date of shift start (e.g. 21:00–06:00 uses the evening date). */
export function getDutyDate(startsAt: string): string | null {
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DUTY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) return null;
  return `${y}-${m}-${day}`;
}

export type GuardShiftRef = {
  userId: number;
  startsAt: string;
  endsAt: string;
  status: string;
  id?: number;
};

export type GuardUserRef = {
  id: number;
  status: string;
};

export type GuardDutyState =
  | "assigned"
  | "duty_not_started"
  | "on_duty"
  | "missed_duty";

export type GuardAvailabilityState =
  | "disabled"
  | "available"
  | "recharging"
  | "assigned"
  | "duty_not_started"
  | "on_duty"
  | "missed_duty";

export type GuardDutyWindow = {
  startsAt: string;
  endsAt: string;
  status?: string;
  id?: number;
};

export type GuardAvailabilityInfo = {
  state: GuardAvailabilityState;
  dutyState?: GuardDutyState | null;
  canAssign: boolean;
  lastShiftEndedAt: Date | null;
  rechargingUntil: Date | null;
  msUntilAvailable: number | null;
  /** Current / primary shift window — used when checking a future proposed start. */
  currentShiftStartsAt?: string | null;
  currentShiftEndsAt?: string | null;
  /**
   * Known non-cancelled duties (scheduled / active / missed) used for recharge,
   * overlap, and one-duty-per-day checks against a proposed start.
   */
  duties?: GuardDutyWindow[];
};

export type ProposedAssignStatus = {
  canAssign: boolean;
  state: GuardAvailabilityState;
  label: string;
  rechargingUntil: Date | null;
};

export function guardAvailabilityLabel(state: GuardAvailabilityState): string {
  switch (state) {
    case "assigned":
      return "Assigned";
    case "duty_not_started":
      return "Duty not started";
    case "on_duty":
      return "On duty";
    case "missed_duty":
      return "Missed duty";
    case "recharging":
      return "Recharging";
    case "disabled":
      return "Disabled";
    default:
      return "Available";
  }
}

export function isGuardAccountActive(status: string) {
  return status === "active";
}

/** Map API availability payload to client info. */
export function mapApiAvailability(
  raw: {
    state: string;
    dutyState?: string | null;
    canAssign?: boolean;
    rechargingUntil?: string | Date | null;
    lastShiftEndedAt?: string | Date | null;
    currentShift?: { startsAt?: string | null; endsAt?: string | null } | null;
    duties?: GuardDutyWindow[] | null;
  },
  currentShift?: { startsAt?: string | null; endsAt?: string | null } | null,
  duties?: GuardDutyWindow[] | null,
): GuardAvailabilityInfo {
  const lastShiftEndedAt = raw.lastShiftEndedAt ? new Date(raw.lastShiftEndedAt) : null;
  const rechargingUntil = raw.rechargingUntil ? new Date(raw.rechargingUntil) : null;
  const state = raw.state as GuardAvailabilityState;
  const shift = currentShift ?? raw.currentShift ?? null;
  const dutyList = duties ?? raw.duties ?? [];
  return {
    state,
    dutyState: (raw.dutyState as GuardDutyState | null) ?? null,
    canAssign: Boolean(raw.canAssign),
    lastShiftEndedAt: lastShiftEndedAt && !Number.isNaN(lastShiftEndedAt.getTime()) ? lastShiftEndedAt : null,
    rechargingUntil: rechargingUntil && !Number.isNaN(rechargingUntil.getTime()) ? rechargingUntil : null,
    msUntilAvailable:
      state === "recharging" && rechargingUntil
        ? Math.max(0, rechargingUntil.getTime() - Date.now())
        : null,
    currentShiftStartsAt: shift?.startsAt ?? null,
    currentShiftEndsAt: shift?.endsAt ?? null,
    duties: dutyList
      .filter((d) => d?.startsAt && d?.endsAt)
      .map((d) => ({
        startsAt: String(d.startsAt),
        endsAt: String(d.endsAt),
        status: d.status,
        id: d.id,
      })),
  };
}

export function canAssignGuard(info: GuardAvailabilityInfo) {
  return info.canAssign;
}

/**
 * Whether a guard can be assigned a duty that *starts* at `proposedStartMs`.
 * Recharge uses the latest prior duty end (completed *or* scheduled) before this start.
 */
export function availabilityForProposedStart(
  info: GuardAvailabilityInfo,
  proposedStartMs: number | null,
  proposedEndMs: number | null = null,
  extraDuties: GuardDutyWindow[] = [],
): ProposedAssignStatus {
  if (info.state === "disabled") {
    return { canAssign: false, state: "disabled", label: "Disabled", rechargingUntil: null };
  }
  if (proposedStartMs == null || Number.isNaN(proposedStartMs)) {
    return {
      canAssign: false,
      state: info.state,
      label: "Set start time first",
      rechargingUntil: info.rechargingUntil,
    };
  }

  const proposedDutyDate = getDutyDate(new Date(proposedStartMs).toISOString());
  const endMs =
    proposedEndMs != null && !Number.isNaN(proposedEndMs) ? proposedEndMs : proposedStartMs + 1;

  const windows: GuardDutyWindow[] = [...(info.duties ?? []), ...extraDuties];
  if (info.currentShiftStartsAt && info.currentShiftEndsAt) {
    const already = windows.some(
      (d) => d.startsAt === info.currentShiftStartsAt && d.endsAt === info.currentShiftEndsAt,
    );
    if (!already) {
      windows.push({
        startsAt: info.currentShiftStartsAt,
        endsAt: info.currentShiftEndsAt,
        status: info.state,
      });
    }
  }

  for (const duty of windows) {
    const dStart = new Date(duty.startsAt).getTime();
    const dEnd = new Date(duty.endsAt).getTime();
    if (Number.isNaN(dStart) || Number.isNaN(dEnd)) continue;

    const dutyDate = getDutyDate(duty.startsAt);
    if (proposedDutyDate && dutyDate && dutyDate === proposedDutyDate) {
      return {
        canAssign: false,
        state: (duty.status as GuardAvailabilityState) || info.state,
        label: "Already has duty that day",
        rechargingUntil: null,
      };
    }

    if (dStart < endMs && dEnd > proposedStartMs) {
      return {
        canAssign: false,
        state: info.state,
        label: "Overlaps existing duty",
        rechargingUntil: null,
      };
    }
  }

  let lastEndedMs: number | null = null;
  if (info.lastShiftEndedAt) {
    const ended = info.lastShiftEndedAt.getTime();
    if (!Number.isNaN(ended) && ended < proposedStartMs) lastEndedMs = ended;
  }
  for (const duty of windows) {
    const dEnd = new Date(duty.endsAt).getTime();
    if (Number.isNaN(dEnd) || dEnd >= proposedStartMs) continue;
    if (lastEndedMs == null || dEnd > lastEndedMs) lastEndedMs = dEnd;
  }

  if (lastEndedMs != null) {
    const earliest = lastEndedMs + GUARD_RECHARGE_MS;
    if (proposedStartMs < earliest) {
      return {
        canAssign: false,
        state: "recharging",
        label: "Recharging",
        rechargingUntil: new Date(earliest),
      };
    }
  }

  return {
    canAssign: true,
    state: info.state === "recharging" || info.state === "assigned" ? "available" : info.state,
    label:
      info.state === "recharging" || info.state === "available" || info.state === "assigned"
        ? "Available"
        : guardAvailabilityLabel(info.state),
    rechargingUntil: null,
  };
}

/** Fallback when roster API unavailable — basic check from shift list only. */
export function evaluateGuardAvailability(
  guard: GuardUserRef,
  shifts: GuardShiftRef[],
  now = Date.now(),
): GuardAvailabilityInfo {
  if (!isGuardAccountActive(guard.status)) {
    return {
      state: "disabled",
      canAssign: false,
      lastShiftEndedAt: null,
      rechargingUntil: null,
      msUntilAvailable: null,
    };
  }

  const userShifts = shifts.filter((s) => s.userId === guard.id && s.status !== "cancelled");
  const inWindow = userShifts.filter((s) => {
    const start = new Date(s.startsAt).getTime();
    const end = new Date(s.endsAt).getTime();
    return now >= start && now < end;
  });

  const active = inWindow.find((s) => s.status === "active");
  if (active) {
    return {
      state: "on_duty",
      dutyState: "on_duty",
      canAssign: false,
      lastShiftEndedAt: null,
      rechargingUntil: null,
      msUntilAvailable: null,
      currentShiftStartsAt: active.startsAt,
      currentShiftEndsAt: active.endsAt,
    };
  }

  const scheduled = inWindow.find((s) => s.status === "scheduled");
  if (scheduled) {
    return {
      state: "duty_not_started",
      dutyState: "duty_not_started",
      canAssign: false,
      lastShiftEndedAt: null,
      rechargingUntil: null,
      msUntilAvailable: null,
      currentShiftStartsAt: scheduled.startsAt,
      currentShiftEndsAt: scheduled.endsAt,
    };
  }

  const missed = inWindow.find((s) => s.status === "missed");
  if (missed) {
    return {
      state: "missed_duty",
      dutyState: "missed_duty",
      canAssign: true,
      lastShiftEndedAt: null,
      rechargingUntil: null,
      msUntilAvailable: null,
      currentShiftStartsAt: missed.startsAt,
      currentShiftEndsAt: missed.endsAt,
    };
  }

  const upcoming = userShifts
    .filter((s) => s.status === "scheduled" && new Date(s.startsAt).getTime() > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];

  if (upcoming) {
    return {
      state: "assigned",
      dutyState: "assigned",
      canAssign: true,
      lastShiftEndedAt: null,
      rechargingUntil: null,
      msUntilAvailable: null,
      currentShiftStartsAt: upcoming.startsAt,
      currentShiftEndsAt: upcoming.endsAt,
    };
  }

  return {
    state: "available",
    canAssign: true,
    lastShiftEndedAt: null,
    rechargingUntil: null,
    msUntilAvailable: null,
  };
}

export function canAssignGuardToShift(guard: GuardUserRef, shifts: GuardShiftRef[], now = Date.now()) {
  return evaluateGuardAvailability(guard, shifts, now).canAssign;
}

export function shiftDutyLabel(dutyState: string | null | undefined): string {
  if (!dutyState) return "—";
  return guardAvailabilityLabel(dutyState as GuardAvailabilityState);
}

const siteDutyBadgeClass: Partial<Record<GuardAvailabilityState, string>> = {
  on_duty: "inline-flex rounded-full border border-sky-200 bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800",
  missed_duty:
    "inline-flex rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800",
  duty_not_started:
    "inline-flex rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-900",
  assigned:
    "inline-flex rounded-full border border-violet-200 bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-900",
};

/** Badge for trained-sites table when this site is the guard's current shift site. */
export function trainedSiteDutyBadge(
  siteId: number,
  currentSiteId: number | null | undefined,
  availability: GuardAvailabilityInfo,
): { label: string; className: string } | null {
  if (currentSiteId == null || siteId !== currentSiteId) return null;

  const state = (availability.dutyState ?? availability.state) as GuardAvailabilityState;
  if (!siteDutyBadgeClass[state]) return null;

  const label =
    state === "on_duty"
      ? "On duty here"
      : state === "missed_duty"
        ? "Missed duty here"
        : state === "duty_not_started"
          ? "Duty not started here"
          : "Assigned here";

  return { label, className: siteDutyBadgeClass[state]! };
}
