"use client";

import { createContext, useContext } from "react";

const PortalFocusContext = createContext(false);

export function PortalFocusProvider({
  value,
  children,
}: {
  value: boolean;
  children: React.ReactNode;
}) {
  return <PortalFocusContext.Provider value={value}>{children}</PortalFocusContext.Provider>;
}

export function usePortalFocus() {
  return useContext(PortalFocusContext);
}
