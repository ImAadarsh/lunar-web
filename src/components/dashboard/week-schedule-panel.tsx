"use client";

import { useState } from "react";
import { WeekScheduleCsvImport } from "@/components/dashboard/week-schedule-csv-import";
import { WeekScheduleForm } from "@/components/dashboard/week-schedule-form";
import { cn } from "@/lib/cn";

type WeekSchedulePanelProps = {
  userId: number;
  trainedSites: Array<{ siteId: number; siteName: string }>;
  isAdmin: boolean;
};

const TABS = [
  { id: "manual", label: "Pick days" },
  { id: "csv", label: "Import CSV" },
] as const;

export function WeekSchedulePanel({ userId, trainedSites, isAdmin }: WeekSchedulePanelProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("manual");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900",
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "manual" ? (
        <WeekScheduleForm userId={userId} trainedSites={trainedSites} isAdmin={isAdmin} />
      ) : (
        <WeekScheduleCsvImport userId={userId} trainedSites={trainedSites} isAdmin={isAdmin} />
      )}
    </div>
  );
}
