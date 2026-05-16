import { AssignShiftFromSiteForm } from "@/components/dashboard/assign-shift-from-site-form";
import { PortalModal } from "@/components/portal/portal-modal";
import type { GuardAvailabilityInfo } from "@/lib/guard-availability";

type TrainedGuardOption = {
  userId: number;
  label: string;
  availability: GuardAvailabilityInfo;
};

type AssignGuardModalProps = {
  siteId: number;
  guards: TrainedGuardOption[];
};

export function AssignGuardModal({ siteId, guards }: AssignGuardModalProps) {
  const assignable = guards.filter((g) => g.availability.canAssign);

  return (
    <PortalModal
      triggerLabel="Assign guard"
      title="Assign guard"
      description="Pick a trained guard who is assignable and set the shift window."
      triggerClassName="lunar-btn-primary lunar-btn-sm sm:lunar-btn-primary"
      size="md"
    >
      {guards.length === 0 ? (
        <p className="text-sm text-slate-500">No guards are trained for this site yet. Add training on the Trained guards tab.</p>
      ) : assignable.length === 0 ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          No guards can be assigned right now. Try again when someone is available.
        </p>
      ) : null}
      <AssignShiftFromSiteForm siteId={siteId} guards={guards} />
    </PortalModal>
  );
}
