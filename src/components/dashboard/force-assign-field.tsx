import { GUARD_RECHARGE_HOURS } from "@/lib/guard-availability";

type ForceAssignFieldProps = {
  isAdmin: boolean;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export function ForceAssignField({ isAdmin, checked, onCheckedChange }: ForceAssignFieldProps) {
  if (!isAdmin) return null;

  const controlled = onCheckedChange != null;

  return (
    <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
      <input
        type="checkbox"
        name="force"
        value="1"
        className="mt-0.5"
        {...(controlled
          ? { checked: Boolean(checked), onChange: (e) => onCheckedChange(e.target.checked) }
          : {})}
      />
      <span>
        <span className="font-semibold">Force assign</span>
        <span className="mt-0.5 block text-xs text-amber-900/90">
          Admin only — bypass one-duty-per-day and {GUARD_RECHARGE_HOURS}-hour recharge rules.
        </span>
      </span>
    </label>
  );
}
