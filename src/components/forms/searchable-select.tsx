"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

export type SearchableSelectOption = {
  value: string;
  label: string;
};

type SearchableSelectProps = {
  name: string;
  options: SearchableSelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Empty-value option shown first (e.g. "All sites"). Omit for required picks. */
  emptyLabel?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  required?: boolean;
  disabled?: boolean;
  form?: string;
  className?: string;
  listClassName?: string;
};

type MenuPosition = { top: number; left: number; width: number };

export function SearchableSelect({
  name,
  options,
  value: controlledValue,
  defaultValue = "",
  onChange,
  emptyLabel,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  required = false,
  disabled = false,
  form,
  className,
  listClassName,
}: SearchableSelectProps) {
  const isControlled = controlledValue !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const value = isControlled ? controlledValue : uncontrolledValue;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => {
    if (!value) return null;
    return options.find((o) => o.value === value) ?? null;
  }, [options, value]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.includes(q));
  }, [options, search]);

  function setValue(next: string) {
    if (!isControlled) setUncontrolledValue(next);
    onChange?.(next);
    setOpen(false);
    setSearch("");
  }

  function updateMenuPosition() {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const maxHeight = 280;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const openUp = spaceBelow < maxHeight && rect.top > spaceBelow;
    setMenuPos({
      top: openUp ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onReposition = () => updateMenuPosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
      setSearch("");
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const displayLabel = selected?.label ?? (value === "" && emptyLabel ? emptyLabel : placeholder);
  const hasSelection = Boolean(selected) || (value === "" && emptyLabel);

  const menu =
    open && mounted && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            className={cn(
              "portal-theme-panel fixed z-[300] overflow-hidden rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface)] shadow-lg",
              listClassName,
            )}
            style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
          >
            <div className="border-b border-[var(--portal-border)] p-2">
              <input
                ref={searchRef}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="lunar-input-sm w-full"
                aria-label={searchPlaceholder}
                autoComplete="off"
              />
            </div>
            <ul className="max-h-56 overflow-y-auto p-1" role="listbox">
              {emptyLabel ? (
                <li>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === ""}
                    className={cn(
                      "flex w-full rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-[var(--portal-table-row-hover)]",
                      value === "" && "bg-[var(--portal-accent)]/15 font-semibold",
                    )}
                    onClick={() => setValue("")}
                  >
                    {emptyLabel}
                  </button>
                </li>
              ) : null}
              {filtered.length === 0 ? (
                <li className="px-2.5 py-6 text-center text-sm text-[var(--portal-text-muted)]">
                  No matches
                </li>
              ) : (
                filtered.map((opt) => (
                  <li key={opt.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === opt.value}
                      className={cn(
                        "flex w-full rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-[var(--portal-table-row-hover)]",
                        value === opt.value && "bg-[var(--portal-accent)]/15 font-semibold",
                      )}
                      onClick={() => setValue(opt.value)}
                    >
                      <span className="min-w-0 flex-1 leading-snug">{opt.label}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <input
        type="text"
        name={name}
        form={form}
        value={value}
        required={required && !emptyLabel}
        readOnly
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute h-px w-px opacity-0"
        onFocus={(e) => e.target.blur()}
      />
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        className={cn(
          "lunar-select flex w-full items-center justify-between gap-2 text-left",
          !hasSelection && "text-[var(--portal-text-muted)]",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{displayLabel}</span>
        <span className="shrink-0 text-[var(--portal-text-muted)]" aria-hidden>
          ▾
        </span>
      </button>
      {menu}
    </div>
  );
}
