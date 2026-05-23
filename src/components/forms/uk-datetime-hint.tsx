/** Shown under datetime-local fields — times are interpreted as UK (GMT/BST). */
export function UkDateTimeHint({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-[var(--portal-text-muted)] ${className}`.trim()}>
      Times are in UK time (GMT/BST, Europe/London).
    </p>
  );
}
