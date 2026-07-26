"use client";

import { useEffect, useRef } from "react";

/** Quiet cookie refresh — avoid full page RSC reloads that freeze forms mid-edit. */
const INTERVAL_MS = 2 * 60_000;

/**
 * Keeps the httpOnly session cookie fresh while the portal tab is open.
 * Does not remount the page on success (that previously felt like a hang / idle freeze).
 */
export function SessionKeepAlive() {
  const inFlightRef = useRef(false);

  useEffect(() => {
    const tick = async () => {
      if (inFlightRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      inFlightRef.current = true;
      try {
        const res = await fetch("/api/auth/session-refresh", {
          method: "POST",
          credentials: "same-origin",
        });
        // Only force login when the server is certain the session is dead.
        if (res.status === 401) {
          window.location.replace("/login");
        }
      } catch {
        /* ignore transient network errors — do not log out */
      } finally {
        inFlightRef.current = false;
      }
    };

    void tick();
    const timer = setInterval(tick, INTERVAL_MS);

    const onWake = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, []);

  return null;
}
