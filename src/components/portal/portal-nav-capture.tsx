"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { isPortalDetailPath, writeSessionReturnPath } from "@/lib/portal-navigation";

/**
 * Remembers the last non-detail portal URL so detail pages can navigate back
 * even when `returnTo` was not passed on the link.
 */
export function PortalNavCapture() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousRef = useRef<string | null>(null);

  useEffect(() => {
    const query = searchParams.toString();
    const current = query ? `${pathname}?${query}` : pathname;
    const prev = previousRef.current;

    if (isPortalDetailPath(current) && prev && !isPortalDetailPath(prev)) {
      writeSessionReturnPath(prev);
    }

    previousRef.current = current;
  }, [pathname, searchParams]);

  return null;
}
