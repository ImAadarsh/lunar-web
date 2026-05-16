import type { ChartSegment } from "@/components/portal/overview-charts";

type ShiftLike = {
  startsAt: string;
  status: string;
  dutyState?: string | null;
};

type AuditLike = {
  id: number;
  action: string;
  createdAt: string;
  entityType: string;
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "var(--portal-accent)",
  active: "#0ea5e9",
  completed: "#10b981",
  cancelled: "#94a3b8",
};

const DUTY_COLORS: Record<string, string> = {
  on_duty: "#0ea5e9",
  duty_not_started: "#f97316",
  missed_duty: "#f43f5e",
  assigned: "#8b5cf6",
  available: "#10b981",
  recharging: "#64748b",
  disabled: "#94a3b8",
};

export function countByField<T extends string>(items: T[], labels: Record<string, string>): ChartSegment[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item || "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, value]) => ({
      id,
      label: labels[id] ?? id.replace(/_/g, " "),
      value,
      color: STATUS_COLORS[id] ?? DUTY_COLORS[id] ?? "var(--portal-text-muted)",
    }))
    .sort((a, b) => b.value - a.value);
}

export function shiftStatusSegments(shifts: ShiftLike[]): ChartSegment[] {
  const labels: Record<string, string> = {
    scheduled: "Scheduled",
    active: "Active",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return countByField(
    shifts.map((s) => s.status),
    labels,
  );
}

export function shiftDutySegments(shifts: ShiftLike[]): ChartSegment[] {
  const withDuty = shifts.filter((s) => s.dutyState);
  const labels: Record<string, string> = {
    on_duty: "On duty",
    duty_not_started: "Not started",
    missed_duty: "Missed duty",
    assigned: "Assigned",
  };
  return countByField(
    withDuty.map((s) => s.dutyState as string),
    labels,
  );
}

export function shiftsNextSevenDays(shifts: ShiftLike[]) {
  const days: Array<{ id: string; label: string; value: number }> = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i += 1) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
    const value = shifts.filter((s) => {
      const start = new Date(s.startsAt);
      return start.toISOString().slice(0, 10) === key;
    }).length;
    days.push({ id: key, label, value });
  }
  return days;
}

export function auditActivityTimeline(audits: AuditLike[]) {
  const buckets = new Map<string, number>();
  const sorted = [...audits].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  for (const row of sorted.slice(0, 14)) {
    const d = new Date(row.createdAt);
    const key = `${d.getHours()}:00`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .slice(0, 8)
    .map(([label, value], i) => ({
      id: `audit-${i}`,
      label,
      value,
    }));
}

export function auditEntitySegments(audits: AuditLike[]): ChartSegment[] {
  const labels: Record<string, string> = {
    shift: "Shifts",
    user: "Users",
    site: "Sites",
    payroll_run: "Payroll",
    export_job: "Exports",
  };
  return countByField(
    audits.map((a) => a.entityType),
    labels,
  );
}
