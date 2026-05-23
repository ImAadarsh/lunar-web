import { WeekSchedulePanel } from "@/components/dashboard/week-schedule-panel";
import { PortalModal } from "@/components/portal/portal-modal";

type WeekScheduleModalProps = {
  userId: number;
  trainedSites: Array<{ siteId: number; siteName: string }>;
  isAdmin: boolean;
};

export function WeekScheduleModal({ userId, trainedSites, isAdmin }: WeekScheduleModalProps) {
  return (
    <PortalModal
      triggerLabel="Week schedule"
      title="Schedule a week"
      description="Pick days manually or import a CSV roster. One duty per duty day (start date)."
      triggerClassName="lunar-btn-secondary lunar-btn-sm"
      size="lg"
    >
      <WeekSchedulePanel userId={userId} trainedSites={trainedSites} isAdmin={isAdmin} />
    </PortalModal>
  );
}
