"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const INTERVAL_MS = 60_000;

/** Periodically asks the server to refresh only if the access JWT is already expired (pairs with middleware). */
export function SessionKeepAlive() {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch("/api/auth/session-refresh", {
          method: "POST",
          credentials: "same-origin",
        });
        if (res.status === 200) {
          router.refresh();
        }
      } catch {
        /* ignore transient network errors */
      }
    };

    timerRef.current = setInterval(tick, INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [router]);

  return null;
}
