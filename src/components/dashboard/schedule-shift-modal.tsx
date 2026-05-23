import { AssignShiftFromGuardForm } from "@/components/dashboard/assign-shift-from-guard-form";
import { PortalModal } from "@/components/portal/portal-modal";

type ScheduleShiftModalProps = {
  userId: number;
  canAssign: boolean;
  trainedSites: Array<{ siteId: number; siteName: string }>;
  isAdmin: boolean;
};

export function ScheduleShiftModal({
  userId,
  canAssign,
  trainedSites,
  isAdmin,
}: ScheduleShiftModalProps) {
  return (
    <PortalModal
      triggerLabel="Schedule shift"
      title="Schedule shift"
      description="One duty per duty day (date of start). Future days can be scheduled while other shifts are booked."
      triggerClassName="lunar-btn-primary lunar-btn-sm sm:lunar-btn-primary"
      size="md"
    >
      {!canAssign ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Guard is on duty, in an active window, or recharging — pick a later start time or use force
          assign (admin).
        </p>
      ) : null}
      <AssignShiftFromGuardForm userId={userId} trainedSites={trainedSites} isAdmin={isAdmin} />
    </PortalModal>
  );
}
