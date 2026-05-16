import { cancelShiftAction } from "@/lib/shift-dashboard-actions";

type CancelShiftFormProps = {
  shiftId: number;
  guardId?: number;
  siteId?: number;
  label?: string;
};

export function CancelShiftForm({ shiftId, guardId, siteId, label = "Cancel shift" }: CancelShiftFormProps) {
  return (
    <form action={cancelShiftAction}>
      <input type="hidden" name="id" value={String(shiftId)} />
      {guardId ? <input type="hidden" name="guardId" value={String(guardId)} /> : null}
      {siteId ? <input type="hidden" name="siteId" value={String(siteId)} /> : null}
      <button type="submit" className="lunar-btn-danger lunar-btn-sm">
        {label}
      </button>
    </form>
  );
}
