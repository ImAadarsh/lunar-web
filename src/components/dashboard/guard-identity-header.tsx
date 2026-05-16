import { GuardAvailabilityBadge } from "@/components/portal/guard-availability-badge";
import { StatusBadge } from "@/components/portal/status-badge";
import type { GuardAvailabilityInfo } from "@/lib/guard-availability";

type GuardIdentityHeaderProps = {
  name: string;
  email: string;
  phone?: string | null;
  status: string;
  availability: GuardAvailabilityInfo;
  variant?: "default" | "bar";
};

export function GuardIdentityHeader({
  name,
  email,
  phone,
  status,
  availability,
  variant = "default",
}: GuardIdentityHeaderProps) {
  if (variant === "bar") {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="truncate font-display text-sm font-semibold tracking-tight text-[var(--portal-text)] sm:text-base">{name}</p>
          <p className="truncate text-xs text-[var(--portal-text-muted)]">{email}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          {phone ? (
            <a
              href={`tel:${phone.replace(/\s/g, "")}`}
              className="portal-link hidden text-xs sm:inline"
            >
              {phone}
            </a>
          ) : null}
          <StatusBadge status={status} />
          <GuardAvailabilityBadge info={availability} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-2">
      <div className="min-w-0">
        <p className="font-display text-xl font-semibold tracking-tight text-[var(--portal-text)] sm:text-2xl">{name}</p>
        <p className="mt-0.5 text-sm text-[var(--portal-text-muted)]">{email}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        {phone ? (
          <a href={`tel:${phone.replace(/\s/g, "")}`} className="portal-link text-sm">
            {phone}
          </a>
        ) : null}
        <StatusBadge status={status} />
        <GuardAvailabilityBadge info={availability} showDetail />
      </div>
    </div>
  );
}
