import { goToLogin } from "@/lib/session-expired";
import type { ShiftActionResult } from "@/lib/shift-dashboard-actions";

type Handlers = {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

/**
 * Routes a shift action result to the form's feedback banners.
 * Returns true when the action succeeded, so callers can reset their inputs.
 */
export function applyShiftActionResult(result: ShiftActionResult, handlers: Handlers): boolean {
  if (result.ok) {
    handlers.onSuccess(result.message);
    return true;
  }
  handlers.onError(result.message);
  if (result.sessionExpired) goToLogin();
  return false;
}
