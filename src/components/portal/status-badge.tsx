import { cn } from "@/lib/cn";

type StatusBadgeProps = {
  status: string;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = status.toLowerCase();
  const tone =
    normalized === "approved" || normalized === "resolved" || normalized === "closed" || normalized === "active"
      ? "lunar-badge-success"
      : normalized === "pending" ||
          normalized === "open" ||
          normalized === "in_review" ||
          normalized === "acknowledged" ||
          normalized === "invited"
        ? "lunar-badge-warning"
        : normalized === "rejected" || normalized === "cancelled" || normalized === "suspended"
          ? "lunar-badge-danger"
          : "lunar-badge-neutral";

  return <span className={cn(tone, "capitalize", className)}>{status.replace(/_/g, " ")}</span>;
}
