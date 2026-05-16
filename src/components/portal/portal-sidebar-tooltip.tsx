"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

type PortalSidebarTooltipProps = {
  label: string;
  description?: string;
  show?: boolean;
  accent?: boolean;
  className?: string;
  children: React.ReactNode;
};

/** Floating tooltip (portaled) for collapsed sidebar — avoids overflow/z-index clipping. */
export function PortalSidebarTooltip({
  label,
  description,
  show = true,
  accent = false,
  className,
  children,
}: PortalSidebarTooltipProps) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      top: rect.top + rect.height / 2,
      left: rect.right + 10,
    });
  }, []);

  const open = useCallback(() => {
    updatePosition();
    setVisible(true);
  }, [updatePosition]);

  const close = useCallback(() => {
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [visible, updatePosition]);

  if (!show) return <>{children}</>;

  const tooltip =
    mounted && visible
      ? createPortal(
          <span
            className={cn(
              "portal-sidebar-tooltip portal-sidebar-tooltip--floating",
              accent && "portal-sidebar-tooltip--accent",
            )}
            style={{ top: coords.top, left: coords.left }}
            role="tooltip"
          >
            <span className="portal-sidebar-tooltip__arrow" aria-hidden />
            <span className="portal-sidebar-tooltip__label">{label}</span>
            {description ? <span className="portal-sidebar-tooltip__desc">{description}</span> : null}
          </span>,
          document.body,
        )
      : null;

  return (
    <>
      <span
        ref={wrapRef}
        className={cn("portal-sidebar-tooltip-wrap", className)}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
      >
        {children}
      </span>
      {tooltip}
    </>
  );
}
