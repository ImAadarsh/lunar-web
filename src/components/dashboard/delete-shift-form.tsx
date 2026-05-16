"use client";

import { deleteShiftAction } from "@/lib/shift-dashboard-actions";

type DeleteShiftFormProps = {
  shiftId: number;
  guardId?: number;
  siteId?: number;
  label?: string;
};

export function DeleteShiftForm({
  shiftId,
  guardId,
  siteId,
  label = "Delete",
}: DeleteShiftFormProps) {
  return (
    <form
      action={deleteShiftAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Permanently delete this shift? This cannot be undone. Shifts with check-in history must be cancelled instead.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={String(shiftId)} />
      {guardId ? <input type="hidden" name="guardId" value={String(guardId)} /> : null}
      {siteId ? <input type="hidden" name="siteId" value={String(siteId)} /> : null}
      <button type="submit" className="lunar-btn-danger lunar-btn-sm">
        {label}
      </button>
    </form>
  );
}
