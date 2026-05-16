"use client";

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
import { formatUkDateTime } from "@/lib/format-datetime";
import { shiftDutyLabel } from "@/lib/guard-availability";

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

function toLocalInputValue(value: string) {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type ShiftDetailModalProps = {
  shift: ShiftDetail;
  sites: SiteOption[];
  guards: GuardPickerOption[];
  trainingBySite: Record<string, number[]>;
  updateShiftAction: (formData: FormData) => void | Promise<void>;
};

export function ShiftDetailModal({
  shift,
  sites,
  guards,
  trainingBySite,
  updateShiftAction,
}: ShiftDetailModalProps) {
  const terminal = shift.status === "cancelled" || shift.status === "completed";

  return (
    <PortalModal
      triggerLabel="View"
      title={`Shift #${shift.id}`}
      description={`${shift.siteName} · ${shift.guardName}`}
      triggerClassName="lunar-btn-secondary lunar-btn-sm"
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
          <form action={updateShiftAction} className="mt-3 space-y-3">
            <input type="hidden" name="id" value={String(shift.id)} />
            <TrainedSiteGuardPicker
              sites={sites}
              guards={guards}
              trainingBySite={trainingBySite}
              defaultSiteId={shift.siteId}
              defaultGuardId={shift.userId}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm text-[var(--portal-text-muted)]">
                Start
                <input
                  name="startsAt"
                  type="datetime-local"
                  required
                  defaultValue={toLocalInputValue(shift.startsAt)}
                  className="mt-1 w-full lunar-input"
                />
              </label>
              <label className="block text-sm text-[var(--portal-text-muted)]">
                End
                <input
                  name="endsAt"
                  type="datetime-local"
                  required
                  defaultValue={toLocalInputValue(shift.endsAt)}
                  className="mt-1 w-full lunar-input"
                />
              </label>
            </div>
            <label className="block text-sm text-[var(--portal-text-muted)]">
              Status
              <select name="status" defaultValue={shift.status} className="mt-1 w-full lunar-select capitalize">
                <option value="scheduled">Scheduled</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <button type="submit" className="lunar-btn-primary w-full sm:w-auto">
              Save changes
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
