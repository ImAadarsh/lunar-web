import { StatusBadge } from "@/components/portal/status-badge";

type SiteIdentityHeaderProps = {
  name: string;
  address?: string | null;
  isActive: boolean;
  /** Compact row for the focus shell top bar. */
  variant?: "default" | "bar";
};

export function SiteIdentityHeader({ name, address, isActive, variant = "default" }: SiteIdentityHeaderProps) {
  if (variant === "bar") {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="truncate font-display text-sm font-semibold tracking-tight text-[var(--portal-text)] sm:text-base">
            {name}
          </p>
          {address ? <p className="truncate text-xs text-[var(--portal-text-muted)]">{address}</p> : null}
        </div>
        <StatusBadge status={isActive ? "active" : "inactive"} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-2">
      <div className="min-w-0">
        <p className="font-display text-xl font-semibold tracking-tight text-[var(--portal-text)] sm:text-2xl">{name}</p>
        {address ? <p className="mt-0.5 text-sm text-[var(--portal-text-muted)]">{address}</p> : null}
      </div>
      <div className="sm:ml-auto">
        <StatusBadge status={isActive ? "active" : "inactive"} />
      </div>
    </div>
  );
}
