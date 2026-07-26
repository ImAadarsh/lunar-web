"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { ModalPortal, useBodyScrollLock } from "@/components/ui/modal-portal";
import { cn } from "@/lib/cn";

type FilterDrawerProps = {
  title?: string;
  description?: string;
  /** Compact summary shown next to the Filters button (e.g. active date range). */
  summary?: string;
  triggerLabel?: string;
  triggerClassName?: string;
  children: ReactNode;
  className?: string;
};

export function FilterDrawer({
  title = "Filters",
  description,
  summary,
  triggerLabel = "Filters",
  triggerClassName,
  children,
  className,
}: FilterDrawerProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const close = useCallback(() => setOpen(false), []);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <div className={cn("flex max-w-full flex-wrap items-center justify-end gap-2", className)}>
      {summary ? (
        <span className="max-w-[min(100%,18rem)] truncate text-right text-sm text-[var(--portal-text-muted)]">
          {summary}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          cn(
            "lunar-btn-primary lunar-btn-sm inline-flex shrink-0 items-center gap-2 shadow-sm ring-2 ring-[var(--portal-accent)]/35 ring-offset-2 ring-offset-[var(--portal-surface)]",
            summary && "ring-[var(--portal-accent)]/60",
          )
        }
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <FilterIcon />
        {triggerLabel}
      </button>

      {open ? (
        <ModalPortal>
          <div className="fixed inset-0 z-[220] flex justify-end" role="presentation">
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
              aria-label="Close filters"
              onClick={close}
            />
            <aside
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="portal-theme-panel relative z-10 flex h-full w-full max-w-md flex-col border-l border-[var(--portal-border)] bg-[var(--portal-surface)] shadow-2xl"
            >
              <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--portal-border)] px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <h2 id={titleId} className="font-display text-lg font-semibold text-[var(--portal-text)]">
                    {title}
                  </h2>
                  {description ? (
                    <p className="mt-0.5 text-sm text-[var(--portal-text-muted)]">{description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg p-2 text-[var(--portal-text-muted)] hover:bg-[var(--portal-table-row-hover)] hover:text-[var(--portal-text)]"
                  aria-label="Close"
                >
                  <CloseIcon />
                </button>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
                {children}
              </div>
            </aside>
          </div>
        </ModalPortal>
      ) : null}
    </div>
  );
}

function FilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 5h16M7 12h10M10 19h4" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}
