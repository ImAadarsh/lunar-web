"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CancelShiftForm } from "@/components/dashboard/cancel-shift-form";
import { DeleteShiftForm } from "@/components/dashboard/delete-shift-form";
import { DetailTable } from "@/components/portal/detail-table";
import { PortalModal } from "@/components/portal/portal-modal";
import { StatusBadge } from "@/components/portal/status-badge";
import {
  TrainedSiteGuardPicker,
  type GuardPickerOption,
  type SiteOption,
} from "@/components/shifts/trained-site-guard-picker";
import { DutyScheduleHint } from "@/components/dashboard/duty-schedule-hint";
import { ForceAssignField } from "@/components/dashboard/force-assign-field";
import { ActionFeedback } from "@/components/forms/action-feedback";
import { formatUkDateTime } from "@/lib/format-datetime";
import { shiftDutyLabel } from "@/lib/guard-availability";
import { updateShiftAction } from "@/lib/shift-dashboard-actions";
import { isoToUkDateTimeLocal } from "@/lib/uk-datetime";
import type { ReactNode } from "react";

export type ShiftDetail = {
  id: number;
  siteId: number;
  siteName: string;
  userId: number;
  guardName: string;
  guardEmail: string;
  startsAt: string;
  endsAt: string;
  status: string;
  dutyState?: string | null;
};

type ShiftDetailModalProps = {
  shift: ShiftDetail;
  sites: SiteOption[];
  guards: GuardPickerOption[];
  trainingBySite: Record<string, number[]>;
  isAdmin?: boolean;
  trigger?: ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
};

export function ShiftDetailModal({
  shift,
  sites,
  guards,
  trainingBySite,
  isAdmin = false,
  trigger,
  triggerClassName = "lunar-btn-secondary lunar-btn-sm",
  triggerLabel = "View",
}: ShiftDetailModalProps) {
  const router = useRouter();
  const terminal = shift.status === "cancelled" || shift.status === "completed";
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
        const result = await updateShiftAction(fd);
        setSuccess(result.message);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update shift.");
      }
    });
  }

  return (
    <PortalModal
      triggerLabel={triggerLabel}
      trigger={trigger}
      title={`Shift #${shift.id}`}
      description={`${shift.siteName} · ${shift.guardName}`}
      triggerClassName={triggerClassName}
      panelClassName="max-w-lg"
    >
      <DetailTable
        className="mt-1"
        rows={[
          { label: "Site", value: shift.siteName },
          {
            label: "Guard",
            value: (
              <div>
                <p className="font-medium">{shift.guardName}</p>
                {shift.guardEmail ? (
                  <p className="text-xs text-[var(--portal-text-muted)]">{shift.guardEmail}</p>
                ) : null}
              </div>
            ),
          },
          { label: "Start", value: formatUkDateTime(shift.startsAt) },
          { label: "End", value: formatUkDateTime(shift.endsAt) },
          {
            label: "Duty",
            value: shift.dutyState ? (
              <span className="lunar-badge-neutral">{shiftDutyLabel(shift.dutyState)}</span>
            ) : (
              "—"
            ),
          },
          { label: "Status", value: <StatusBadge status={shift.status} /> },
        ]}
      />

      {!terminal ? (
        <>
          <h3 className="portal-section-title mt-5">Edit shift</h3>
          <DutyScheduleHint />
          <form onSubmit={onSubmit} className="mt-3 space-y-3">
            <ActionFeedback success={success} error={error} />
            <input type="hidden" name="id" value={String(shift.id)} />
            <TrainedSiteGuardPicker
              sites={sites}
              guards={guards}
              trainingBySite={trainingBySite}
              defaultSiteId={shift.siteId}
              defaultGuardId={shift.userId}
              defaultStartsAt={isoToUkDateTimeLocal(shift.startsAt)}
              defaultEndsAt={isoToUkDateTimeLocal(shift.endsAt)}
              allowUnavailable
            />
            <label className="block text-sm text-[var(--portal-text-muted)]">
              Status
              <select name="status" defaultValue={shift.status} className="mt-1 w-full lunar-select capitalize">
                <option value="scheduled">Scheduled</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <ForceAssignField isAdmin={isAdmin} />
            <button type="submit" className="lunar-btn-primary w-full sm:w-auto" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </button>
          </form>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--portal-border)] pt-4">
            <CancelShiftForm shiftId={shift.id} guardId={shift.userId} siteId={shift.siteId} label="Cancel shift" />
            <DeleteShiftForm shiftId={shift.id} guardId={shift.userId} siteId={shift.siteId} />
          </div>
        </>
      ) : (
        <div className="mt-5 border-t border-[var(--portal-border)] pt-4">
          <p className="text-sm text-[var(--portal-text-muted)]">
            This shift is {shift.status.replace(/_/g, " ")} and cannot be edited.
          </p>
          <div className="mt-3">
            <DeleteShiftForm shiftId={shift.id} guardId={shift.userId} siteId={shift.siteId} />
          </div>
        </div>
      )}
    </PortalModal>
  );
}
