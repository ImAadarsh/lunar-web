import { cn } from "@/lib/cn";

type PortalTableCardProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned header controls (e.g. a "view all" link). */
  actions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** When true, card grows to fill remaining page height (table scrolls inside). */
  fill?: boolean;
  /** When false, children manage their own scroll regions (e.g. PortalClientDataTable). */
  wrapTable?: boolean;
  /** Extra classes on the scrollable table wrapper (e.g. lunar-table-wrap--tall). */
  tableWrapClassName?: string;
};

/** Card with a fixed title and a scrollable table region only. */
export function PortalTableCard({
  title,
  description,
  actions,
  children,
  footer,
  className,
  fill = false,
  wrapTable = true,
  tableWrapClassName,
}: PortalTableCardProps) {
  const hasHeader = Boolean(title || description || actions);

  return (
    <section
      className={cn(
        "lunar-card lunar-card-pad flex flex-col overflow-hidden",
        fill && "min-h-0 flex-1",
        className,
      )}
    >
      {hasHeader ? (
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              typeof title === "string" ? (
                <h2 className="text-lg font-semibold text-[var(--portal-text)]">{title}</h2>
              ) : (
                title
              )
            ) : null}
            {description ? <div className="mt-1 text-sm text-[var(--portal-text-muted)]">{description}</div> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div
        className={cn(
          hasHeader ? "mt-3 min-h-0 flex-1" : "min-h-0 flex-1",
          wrapTable ? cn("lunar-table-wrap", tableWrapClassName) : "flex flex-col overflow-hidden",
        )}
      >
        {children}
      </div>
      {footer ? <div className="mt-3 shrink-0 border-t border-[var(--portal-border)] pt-3">{footer}</div> : null}
    </section>
  );
}
