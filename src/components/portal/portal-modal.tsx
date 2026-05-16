"use client";

import { useCallback, useEffect, useState } from "react";
import { ModalPortal, useBodyScrollLock } from "@/components/ui/modal-portal";
import { cn } from "@/lib/cn";

type PortalModalSize = "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<PortalModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

type PortalModalProps = {
  triggerLabel: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  triggerClassName?: string;
  panelClassName?: string;
  size?: PortalModalSize;
};

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function PortalModal({
  triggerLabel,
  title,
  description,
  children,
  triggerClassName,
  panelClassName,
  size = "lg",
}: PortalModalProps) {
  const [open, setOpen] = useState(false);
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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName ?? "lunar-btn-primary"}
      >
        {triggerLabel}
      </button>
      {open ? (
        <ModalPortal>
          <div
            className="portal-modal-backdrop fixed inset-0 z-[200] flex items-end justify-center p-0 backdrop-blur-md sm:items-center sm:p-4"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="portal-modal-title"
              className={cn(
                "portal-theme-panel flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl shadow-2xl sm:max-h-[min(92dvh,880px)] sm:rounded-2xl",
                sizeClasses[size],
                panelClassName
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--portal-border)] bg-[var(--portal-surface)] px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
                <div className="min-w-0 pr-2">
                  <h2
                    id="portal-modal-title"
                    className="font-display portal-section-title sm:text-lg"
                  >
                    {title}
                  </h2>
                  {description ? (
                    <p className="portal-section-muted mt-1">{description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="lunar-btn-secondary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl p-0"
                  aria-label="Close dialog"
                >
                  <CloseIcon />
                </button>
              </div>
              <div className="portal-modal-body min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 sm:px-6">
                {children}
              </div>
            </div>
          </div>
        </ModalPortal>
      ) : null}
    </>
  );
}
