import { cn } from "@/lib/cn";

type PortalTableCardProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
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
  children,
  footer,
  className,
  fill = false,
  wrapTable = true,
  tableWrapClassName,
}: PortalTableCardProps) {
  const hasHeader = Boolean(title || description);

  return (
    <section
      className={cn(
        "lunar-card lunar-card-pad flex flex-col overflow-hidden",
        fill && "min-h-0 flex-1",
        className,
      )}
    >
      {hasHeader ? (
        <div className="shrink-0">
          {title ? (
            typeof title === "string" ? (
              <h2 className="text-lg font-semibold text-[var(--portal-text)]">{title}</h2>
            ) : (
              title
            )
          ) : null}
          {description ? <div className="mt-1 text-sm text-[var(--portal-text-muted)]">{description}</div> : null}
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
