import { CancelShiftForm } from "@/components/dashboard/cancel-shift-form";
import { DeleteShiftForm } from "@/components/dashboard/delete-shift-form";

type ShiftRowActionsProps = {
  shiftId: number;
  status: string;
  guardId?: number;
  siteId?: number;
};

export function ShiftRowActions({ shiftId, status, guardId, siteId }: ShiftRowActionsProps) {
  const terminal = status === "cancelled" || status === "completed";

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {!terminal ? <CancelShiftForm shiftId={shiftId} guardId={guardId} siteId={siteId} label="Cancel" /> : null}
      <DeleteShiftForm shiftId={shiftId} guardId={guardId} siteId={siteId} />
    </div>
  );
}
