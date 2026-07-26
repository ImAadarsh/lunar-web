"use client";

import { PortalModal } from "@/components/portal/portal-modal";

type PayrollLineAdjustFormProps = {
  runId: number;
  userId: number;
  userLabel: string;
  action: (formData: FormData) => Promise<void>;
  disabled?: boolean;
};

export function PayrollLineAdjustForm({
  runId,
  userId,
  userLabel,
  action,
  disabled = false,
}: PayrollLineAdjustFormProps) {
  if (disabled) return null;

  return (
    <PortalModal
      triggerLabel="Adjust"
      title={`Adjust · ${userLabel}`}
      description="Positive pence adds pay; negative pence deducts. The run recalculates after save."
      triggerClassName="lunar-btn-secondary lunar-btn-sm"
    >
      <form action={action} className="space-y-3">
        <input type="hidden" name="runId" value={String(runId)} />
        <input type="hidden" name="userId" value={String(userId)} />
        <select name="kind" defaultValue="correction" className="lunar-input">
          <option value="bonus">bonus</option>
          <option value="deduction">deduction</option>
          <option value="correction">correction</option>
          <option value="other">other</option>
        </select>
        <input
          name="amountPence"
          type="number"
          required
          placeholder="Amount in pence, e.g. 2500 or -1000"
          className="lunar-input"
        />
        <input name="reason" placeholder="Reason (optional)" className="lunar-input" />
        <button className="lunar-btn-primary w-full">Save adjustment</button>
      </form>
    </PortalModal>
  );
}
