"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "lunar_portal_sidebar_collapsed";

type PortalSidebarContextValue = {
  collapsed: boolean;
  toggle: () => void;
};

const PortalSidebarContext = createContext<PortalSidebarContextValue | null>(null);

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function PortalSidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(readCollapsed());
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ collapsed, toggle }), [collapsed, toggle]);

  return <PortalSidebarContext.Provider value={value}>{children}</PortalSidebarContext.Provider>;
}

export function usePortalSidebar() {
  const ctx = useContext(PortalSidebarContext);
  if (!ctx) {
    throw new Error("usePortalSidebar must be used within PortalSidebarProvider");
  }
  return ctx;
}
