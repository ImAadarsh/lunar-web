"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type FocusDashboardHeaderContextValue = {
  content: React.ReactNode;
  setContent: (node: React.ReactNode) => void;
};

const FocusDashboardHeaderContext = createContext<FocusDashboardHeaderContextValue | null>(null);

export function FocusDashboardHeaderProvider({ children }: { children: React.ReactNode }) {
  const [content, setContentState] = useState<React.ReactNode>(null);
  const setContent = useCallback((node: React.ReactNode) => {
    setContentState(node);
  }, []);

  const value = useMemo(() => ({ content, setContent }), [content, setContent]);

  return (
    <FocusDashboardHeaderContext.Provider value={value}>{children}</FocusDashboardHeaderContext.Provider>
  );
}

export function useFocusDashboardHeader() {
  return useContext(FocusDashboardHeaderContext);
}
