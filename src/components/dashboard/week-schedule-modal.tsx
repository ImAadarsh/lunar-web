import { WeekSchedulePanel } from "@/components/dashboard/week-schedule-panel";
import { PortalModal } from "@/components/portal/portal-modal";
import { GUARD_RECHARGE_HOURS, type GuardAvailabilityInfo } from "@/lib/guard-availability";

type WeekScheduleModalProps = {
  userId: number;
  trainedSites: Array<{ siteId: number; siteName: string }>;
  isAdmin: boolean;
  availability?: GuardAvailabilityInfo | null;
};

export function WeekScheduleModal({
  userId,
  trainedSites,
  isAdmin,
  availability = null,
}: WeekScheduleModalProps) {
  return (
    <PortalModal
      triggerLabel="Week schedule"
      title="Schedule a week"
      description={`One duty per duty day. ${GUARD_RECHARGE_HOURS}h rest after each prior duty (completed or scheduled).`}
      triggerClassName="lunar-btn-secondary lunar-btn-sm"
      size="lg"
    >
      <WeekSchedulePanel
        userId={userId}
        trainedSites={trainedSites}
        isAdmin={isAdmin}
        availability={availability}
      />
    </PortalModal>
  );
}
