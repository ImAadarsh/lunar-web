/** Guard duty availability — synced with backend guardDutyService.js */

export const GUARD_RECHARGE_HOURS = 7;
export const GUARD_RECHARGE_MS = GUARD_RECHARGE_HOURS * 60 * 60 * 1000;

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

export type GuardAvailabilityInfo = {
  state: GuardAvailabilityState;
  dutyState?: GuardDutyState | null;
  canAssign: boolean;
  lastShiftEndedAt: Date | null;
  rechargingUntil: Date | null;
  msUntilAvailable: number | null;
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
export function mapApiAvailability(raw: {
  state: string;
  dutyState?: string | null;
  canAssign?: boolean;
  rechargingUntil?: string | Date | null;
  lastShiftEndedAt?: string | Date | null;
}): GuardAvailabilityInfo {
  const lastShiftEndedAt = raw.lastShiftEndedAt ? new Date(raw.lastShiftEndedAt) : null;
  const rechargingUntil = raw.rechargingUntil ? new Date(raw.rechargingUntil) : null;
  const state = raw.state as GuardAvailabilityState;
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
  };
}

export function canAssignGuard(info: GuardAvailabilityInfo) {
  return info.canAssign;
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
    };
  }

  const upcoming = userShifts
    .filter((s) => s.status === "scheduled" && new Date(s.startsAt).getTime() > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];

  if (upcoming) {
    return {
      state: "assigned",
      dutyState: "assigned",
      canAssign: false,
      lastShiftEndedAt: null,
      rechargingUntil: null,
      msUntilAvailable: null,
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
