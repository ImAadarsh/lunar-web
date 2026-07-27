"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ActionFeedback } from "@/components/forms/action-feedback";
import { cancelShiftAction } from "@/lib/shift-dashboard-actions";

type CancelShiftFormProps = {
  shiftId: number;
  guardId?: number;
  siteId?: number;
  label?: string;
};

export function CancelShiftForm({ shiftId, guardId, siteId, label = "Cancel shift" }: CancelShiftFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const result = await cancelShiftAction(fd);
        setSuccess(result.message);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not cancel shift.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <ActionFeedback success={success} error={error} />
      <input type="hidden" name="id" value={String(shiftId)} />
      {guardId ? <input type="hidden" name="guardId" value={String(guardId)} /> : null}
      {siteId ? <input type="hidden" name="siteId" value={String(siteId)} /> : null}
      <button type="submit" className="lunar-btn-danger lunar-btn-sm" disabled={pending || Boolean(success)}>
        {pending ? "Cancelling…" : success ? "Cancelled" : label}
      </button>
    </form>
  );
}
