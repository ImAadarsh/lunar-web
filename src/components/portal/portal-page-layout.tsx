import { cn } from "@/lib/cn";
import { PortalPageFrame } from "@/components/portal/portal-page-frame";

type PortalPageProps = {
  children: React.ReactNode;
  className?: string;
};

/** Full-height portal page shell — fixed header + scrollable body (matches Training layout). */
export function PortalPage({ children, className }: PortalPageProps) {
  return <PortalPageFrame className={className}>{children}</PortalPageFrame>;
}

type PortalPageHeaderProps = {
  title?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** Keep header visible while scrolling page body (focus dashboards). */
  sticky?: boolean;
};

/** Fixed page toolbar: title, optional actions, filters, and notices. */
export function PortalPageHeader({
  title,
  description,
  actions,
  children,
  className,
  sticky = false,
}: PortalPageHeaderProps) {
  const showTitleRow = Boolean(title || description || actions);

  return (
    <div
      className={cn(
        "lunar-card-static shrink-0 px-4 py-3 sm:px-5",
        sticky && "sticky top-0 z-30 border-b border-[var(--portal-border)] bg-[var(--portal-header-bg)] shadow-sm backdrop-blur-md",
        className,
      )}
    >
      <div className="flex flex-col gap-4">
        {showTitleRow ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            {title || description ? (
              <div className="min-w-0 flex-1">
                {title ? (
                  <h2 className="font-display text-lg font-semibold text-[var(--portal-text)]">{title}</h2>
                ) : null}
                {description ? (
                  typeof description === "string" ? (
                    <p className={cn("text-sm text-[var(--portal-text-muted)]", title && "mt-0.5")}>{description}</p>
                  ) : (
                    <div className={cn(title && "mt-1")}>{description}</div>
                  )
                ) : null}
              </div>
            ) : null}
            {actions ? (
              <div className="flex w-full min-w-0 shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                {actions}
              </div>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

type PortalPageBodyProps = {
  children: React.ReactNode;
  className?: string;
  /** When false, body is a plain scroll region without the lunar-card wrapper. */
  card?: boolean;
  /** When true with card, content area has lunar-card-pad. Default false for tables (p-0). */
  padded?: boolean;
  /** When true, the whole body scrolls — use for stat/overview pages. */
  scrollPage?: boolean;
};

/** Main content — table pages use flex + lunar-table-wrap; overviews may set scrollPage. */
export function PortalPageBody({
  children,
  className,
  card = true,
  padded = false,
  scrollPage = false,
}: PortalPageBodyProps) {
  if (!card) {
    return (
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          scrollPage ? "overflow-y-auto" : "overflow-hidden",
          className,
        )}
      >
        <div className={cn("min-h-0 flex-1 pb-1", !scrollPage && "flex flex-col overflow-hidden")}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <section
      className={cn(
        "lunar-card flex min-h-0 flex-1 flex-col overflow-hidden",
        padded ? "lunar-card-pad" : "p-0",
        className,
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </section>
  );
}

/** Card body sized for PortalDataTable (table scroll + pinned pagination). */
export function PortalPageTableBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("lunar-card flex min-h-0 flex-1 flex-col overflow-hidden p-0", className)}>
      {children}
    </section>
  );
}
