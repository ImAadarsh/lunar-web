import { formatUkMonthYear } from "@/lib/format-datetime";

export type LeaveMonthItem = {
  id: number;
  userId: number;
  startDate: string;
  endDate: string;
  status: string;
  leaveType: string;
};

export function currentMonthBounds() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);
  const label = formatUkMonthYear(now);
  return { start, end, label };
}

/** Approved or pending leave overlapping the given calendar month. */
export function leaveOverlapsMonth(leave: LeaveMonthItem, monthStart: string, monthEnd: string) {
  if (leave.status === "cancelled" || leave.status === "rejected") return false;
  return leave.startDate <= monthEnd && leave.endDate >= monthStart;
}

export function leavesInMonthForUser(
  all: LeaveMonthItem[],
  userId: number,
  monthStart: string,
  monthEnd: string,
) {
  return all.filter((item) => item.userId === userId && leaveOverlapsMonth(item, monthStart, monthEnd));
}

export function displayGuardName(guardName?: string | null, userEmail?: string) {
  const name = guardName?.trim();
  if (name) return name;
  return userEmail?.split("@")[0] ?? "Unknown guard";
}
