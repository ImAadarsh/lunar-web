import { AssignShiftFromGuardForm } from "@/components/dashboard/assign-shift-from-guard-form";
import { PortalModal } from "@/components/portal/portal-modal";

type ScheduleShiftModalProps = {
  userId: number;
  canAssign: boolean;
  trainedSites: Array<{ siteId: number; siteName: string }>;
};

export function ScheduleShiftModal({ userId, canAssign, trainedSites }: ScheduleShiftModalProps) {
  return (
    <PortalModal
      triggerLabel="Schedule shift"
      title="Schedule shift"
      description="Assign this guard to a trained site when they are available or after missed duty."
      triggerClassName="lunar-btn-primary lunar-btn-sm sm:lunar-btn-primary"
      size="md"
    >
      {!canAssign ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Guard is not available for new assignments right now.
        </p>
      ) : null}
      <AssignShiftFromGuardForm userId={userId} trainedSites={trainedSites} />
    </PortalModal>
  );
}
