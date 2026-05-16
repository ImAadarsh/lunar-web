import type { BackendAvailability } from "@/lib/dashboard-api";

export type DashboardAlert = {
  severity: "info" | "warning" | "critical";
  code: string;
  message: string;
  href?: string;
};

export type DashboardShiftRow = {
  id: number;
  siteId?: number;
  siteName?: string;
  userId?: number;
  userEmail?: string;
  guardName?: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  dutyState?: string | null;
};

export type ShiftGroups = {
  upcoming: DashboardShiftRow[];
  today: DashboardShiftRow[];
  inProgress: DashboardShiftRow[];
  past: DashboardShiftRow[];
};

export type RecentAttendanceRow = {
  id: number;
  siteId: number;
  siteName: string;
  checkInAt: string;
  checkOutAt?: string | null;
  status: string;
  hours: number | string;
};

export type GuardDashboardData = {
  summary: {
    upcoming: number;
    today: number;
    inProgress: number;
    missed: number;
    completed: number;
    cancelled: number;
    trainedSites: number;
    pendingLeave: number;
  };
  alerts: DashboardAlert[];
  recentAttendance: RecentAttendanceRow[];
  leave: { pending: number; byStatus: Record<string, number> };
  shiftGroups: ShiftGroups;
};

export type SiteDashboardExtras = {
  summary: {
    shiftsToday: number;
    upcoming: number;
    onDuty: number;
    openIncidents: number;
    checkpoints: number;
    trainedGuards: number;
    assignableGuards: number;
    dutyNotStarted: number;
    missedRecent: number;
  };
  rosterCounts: Record<string, number>;
  alerts: DashboardAlert[];
  coverageGaps: Array<{
    shiftId: number;
    userId: number;
    guardName?: string | null;
    userEmail?: string;
    dutyState?: string | null;
    startsAt: string;
    endsAt: string;
  }>;
  shiftGroups: ShiftGroups;
  site: {
    id: number;
    name: string;
    address?: string | null;
    centerLat?: number;
    centerLng?: number;
    geofenceRadiusM?: number | null;
    isActive: number | boolean;
  };
};

export type TrainedGuardRow = {
  userId: number;
  userEmail: string;
  guardName?: string | null;
  trainedOn?: string | null;
  availability: BackendAvailability;
};
