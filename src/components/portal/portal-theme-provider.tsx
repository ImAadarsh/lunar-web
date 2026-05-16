"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  isPortalThemeId,
  PORTAL_THEME_COOKIE,
  type PortalThemeId,
} from "@/lib/portal-theme";

type PortalThemeContextValue = {
  theme: PortalThemeId;
  setTheme: (theme: PortalThemeId) => void;
};

const PortalThemeContext = createContext<PortalThemeContextValue | null>(null);

function readStoredTheme(): PortalThemeId {
  if (typeof document === "undefined") return "default";
  const fromDom = document.documentElement.dataset.portalTheme;
  if (isPortalThemeId(fromDom)) return fromDom;
  try {
    const stored = localStorage.getItem(PORTAL_THEME_COOKIE);
    if (isPortalThemeId(stored)) return stored;
  } catch {
    /* ignore */
  }
  return "default";
}

function applyTheme(theme: PortalThemeId) {
  document.documentElement.dataset.portalTheme = theme;
  document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
  try {
    localStorage.setItem(PORTAL_THEME_COOKIE, theme);
  } catch {
    /* ignore */
  }
  document.cookie = `${PORTAL_THEME_COOKIE}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
}

export function PortalThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<PortalThemeId>("default");

  useEffect(() => {
    const initial = readStoredTheme();
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  const setTheme = useCallback((next: PortalThemeId) => {
    setThemeState(next);
    applyTheme(next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <PortalThemeContext.Provider value={value}>{children}</PortalThemeContext.Provider>;
}

export function usePortalTheme() {
  const ctx = useContext(PortalThemeContext);
  if (!ctx) {
    throw new Error("usePortalTheme must be used within PortalThemeProvider");
  }
  return ctx;
}
