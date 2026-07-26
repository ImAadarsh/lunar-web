"use client";

type DeletePayrollRunFormProps = {
  runId: number;
  action: (formData: FormData) => Promise<void>;
  label?: string;
  className?: string;
};

export function DeletePayrollRunForm({
  runId,
  action,
  label = "Delete",
  className = "lunar-btn-danger lunar-btn-sm",
}: DeletePayrollRunFormProps) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Permanently delete payroll run #${runId}? Lines, adjustments, and payslips for this run will also be removed.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="runId" value={String(runId)} />
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
