"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ActionFeedback } from "@/components/forms/action-feedback";
import {
  TrainedSiteGuardPicker,
  type GuardPickerOption,
  type SiteOption,
} from "@/components/shifts/trained-site-guard-picker";
import { applyShiftActionResult } from "@/lib/shift-action-result";
import { assignGuardShiftAction } from "@/lib/shift-dashboard-actions";

type ManagerAssignShiftFormProps = {
  sites: SiteOption[];
  guards: GuardPickerOption[];
  trainingBySite: Record<string, number[]>;
};

export function ManagerAssignShiftForm({ sites, guards, trainingBySite }: ManagerAssignShiftFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const result = await assignGuardShiftAction(fd);
        if (applyShiftActionResult(result, { onSuccess: setSuccess, onError: setError })) {
          setFormKey((k) => k + 1);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not assign shift.");
      }
      router.refresh();
    });
  }

  return (
    <form key={formKey} onSubmit={onSubmit} className="space-y-3">
      <ActionFeedback success={success} error={error} />
      <TrainedSiteGuardPicker sites={sites} guards={guards} trainingBySite={trainingBySite} />
      <button type="submit" className="lunar-btn-primary w-full" disabled={pending}>
        {pending ? "Saving…" : "Save shift"}
      </button>
    </form>
  );
}
