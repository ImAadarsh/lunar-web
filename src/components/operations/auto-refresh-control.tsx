"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "lunar-command-center-refresh-seconds";

type AutoRefreshControlProps = {
  defaultSeconds?: number;
};

export function AutoRefreshControl({ defaultSeconds = 0 }: AutoRefreshControlProps) {
  const router = useRouter();
  const [seconds, setSeconds] = useState(defaultSeconds);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = Number(saved);
      if (!Number.isNaN(parsed)) setSeconds(parsed);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(seconds));
    if (!seconds) return;
    const id = window.setInterval(() => {
      router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(id);
  }, [seconds, router]);

  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
      <span className="font-medium">Auto-refresh</span>
      <select
        value={String(seconds)}
        onChange={(event) => setSeconds(Number(event.target.value))}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-lunar-400"
      >
        <option value="0">Off</option>
        <option value="10">Every 10s</option>
        <option value="30">Every 30s</option>
      </select>
    </label>
  );
}

