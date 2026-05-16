"use client";

import { useEffect } from "react";
import { useFocusDashboardHeader } from "@/components/portal/focus-dashboard-header-context";

/** Renders children into the focus shell top bar (between Back and Sign out). */
export function FocusDashboardHeader({ children }: { children: React.ReactNode }) {
  const ctx = useFocusDashboardHeader();

  useEffect(() => {
    if (!ctx) return;
    ctx.setContent(children);
    return () => ctx.setContent(null);
  }, [ctx, children]);

  return null;
}
