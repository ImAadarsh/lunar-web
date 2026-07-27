import { AssignShiftFromGuardForm } from "@/components/dashboard/assign-shift-from-guard-form";
import { PortalModal } from "@/components/portal/portal-modal";
import { GUARD_RECHARGE_HOURS, type GuardAvailabilityInfo } from "@/lib/guard-availability";

type ScheduleShiftModalProps = {
  userId: number;
  canAssign: boolean;
  trainedSites: Array<{ siteId: number; siteName: string }>;
  isAdmin: boolean;
  availability?: GuardAvailabilityInfo | null;
  /** Defaults to "Schedule shift". */
  triggerLabel?: string;
  triggerClassName?: string;
};

export function ScheduleShiftModal({
  userId,
  canAssign,
  trainedSites,
  isAdmin,
  availability = null,
  triggerLabel = "Schedule shift",
  triggerClassName = "lunar-btn-primary lunar-btn-sm sm:lunar-btn-primary",
}: ScheduleShiftModalProps) {
  return (
    <PortalModal
      triggerLabel={triggerLabel}
      title="Schedule shift"
      description={`Set start/end times first (add more rows if needed), then pick a trained site. ${GUARD_RECHARGE_HOURS}h rest after each prior duty — completed or already scheduled.`}
      triggerClassName={triggerClassName}
      size="lg"
    >
      {!canAssign ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This guard may not be free right now — set the times below to see if they are free for those starts
          (after {GUARD_RECHARGE_HOURS}h rest from the latest prior duty).
        </p>
      ) : null}
      <AssignShiftFromGuardForm
        userId={userId}
        trainedSites={trainedSites}
        isAdmin={isAdmin}
        availability={availability}
      />
    </PortalModal>
  );
}
