import { AssignShiftFromSiteForm } from "@/components/dashboard/assign-shift-from-site-form";
import { PortalModal } from "@/components/portal/portal-modal";
import { GUARD_RECHARGE_HOURS, type GuardAvailabilityInfo } from "@/lib/guard-availability";

type TrainedGuardOption = {
  userId: number;
  label: string;
  availability: GuardAvailabilityInfo;
};

type AssignGuardModalProps = {
  siteId: number;
  guards: TrainedGuardOption[];
  isAdmin: boolean;
};

export function AssignGuardModal({ siteId, guards, isAdmin }: AssignGuardModalProps) {
  return (
    <PortalModal
      triggerLabel="Assign guard"
      title="Assign shift"
      description={`Times first, then a trained guard free for that start. Use “Add another shift” for multiple. ${GUARD_RECHARGE_HOURS}h rest after prior duties (completed or scheduled).`}
      triggerClassName="lunar-btn-primary lunar-btn-sm sm:lunar-btn-primary"
      size="lg"
    >
      {guards.length === 0 ? (
        <p className="text-sm text-[var(--portal-text-muted)]">
          No guards are trained for this site yet. Add training on the Trained guards tab.
        </p>
      ) : (
        <AssignShiftFromSiteForm siteId={siteId} guards={guards} isAdmin={isAdmin} />
      )}
    </PortalModal>
  );
}
