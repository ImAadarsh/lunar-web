"use client";

import { cn } from "@/lib/cn";

type PortalSelectAllCheckboxProps = {
  formId: string;
  className?: string;
};

/** Select / clear all row checkboxes in a bulk form on the current page. */
export function PortalSelectAllCheckbox({ formId, className }: PortalSelectAllCheckboxProps) {
  return (
    <input
      type="checkbox"
      form={formId}
      className={cn("h-4 w-4 rounded border-slate-300 text-lunar-600", className)}
      aria-label="Select all rows on this page"
      onChange={(e) => {
        const checked = e.target.checked;
        document
          .querySelectorAll<HTMLInputElement>(`input[data-bulk-form="${formId}"][name="ids"]`)
          .forEach((el) => {
            el.checked = checked;
          });
      }}
    />
  );
}

type PortalRowCheckboxProps = {
  formId: string;
  value: number | string;
  className?: string;
};

export function PortalRowCheckbox({ formId, value, className }: PortalRowCheckboxProps) {
  return (
    <input
      type="checkbox"
      form={formId}
      name="ids"
      value={String(value)}
      data-bulk-form={formId}
      className={cn("h-4 w-4 rounded border-slate-300 text-lunar-600", className)}
      aria-label={`Select row ${value}`}
    />
  );
}

export type PortalBulkAction = {
  label: string;
  name: string;
  value: string;
  variant?: "primary" | "secondary" | "danger";
  confirmMessage?: string;
};

type PortalBulkActionBarProps = {
  formId: string;
  actions: PortalBulkAction[];
  className?: string;
};

export function PortalBulkActionBar({ formId, actions, className }: PortalBulkActionBarProps) {
  return (
    <div
      className={cn(
        "portal-bulk-bar flex flex-wrap items-center gap-2.5 rounded-lg border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-3.5 py-2.5",
        className,
      )}
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">
        Bulk actions
      </span>
      {actions.map((action) => (
        <button
          key={`${action.name}-${action.value}`}
          type="submit"
          form={formId}
          name={action.name}
          value={action.value}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold transition",
            action.variant === "danger" &&
              "border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100",
            action.variant === "primary" && "lunar-btn-primary lunar-btn-sm",
            (!action.variant || action.variant === "secondary") && "lunar-btn-secondary lunar-btn-sm",
          )}
          onClick={
            action.confirmMessage
              ? (e) => {
                  if (!window.confirm(action.confirmMessage)) e.preventDefault();
                }
              : undefined
          }
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
