"use server";

import { revalidatePath } from "next/cache";
import { mutateBackend, mutateBackendResult } from "@/lib/portal-mutations";
import { parseBulkIds } from "@/lib/portal-table";
import { ukDateTimeLocalToIso } from "@/lib/uk-datetime";

export type ShiftActionResult = {
  ok: boolean;
  message: string;
  /** Shifts actually written to the backend. */
  count: number;
  /** True when the caller should send the user back to sign in. */
  sessionExpired?: boolean;
  /** Zero-based indexes of submitted rows that were rejected. */
  failedRows?: number[];
};

function failure(message: string, extra?: Partial<ShiftActionResult>): ShiftActionResult {
  return { ok: false, message, count: 0, ...extra };
}

function parseForceAssign(formData: FormData) {
  return formData.get("force") === "1" || formData.get("force") === "on";
}

function revalidateShiftPaths(userId?: number | null, siteId?: number | null) {
  if (userId) revalidatePath(`/manager/guards/${userId}`);
  if (siteId) revalidatePath(`/manager/sites/${siteId}`);
  revalidatePath("/manager/shifts");
}

export async function assignGuardShiftAction(formData: FormData): Promise<ShiftActionResult> {
  const userId = Number(formData.get("userId"));
  const siteId = Number(formData.get("siteId"));
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  if (!userId || !siteId || !startsAt || !endsAt) {
    return failure("Site, guard, start, and end time are required.");
  }

  const result = await mutateBackendResult("/shifts", "POST", {
    siteId,
    userId,
    startsAt: ukDateTimeLocalToIso(startsAt),
    endsAt: ukDateTimeLocalToIso(endsAt),
    status: "scheduled",
    ...(parseForceAssign(formData) ? { force: true } : {}),
  });

  if (!result.ok) {
    return failure(result.message, { sessionExpired: result.sessionExpired, failedRows: [0] });
  }

  revalidateShiftPaths(userId, siteId);
  return { ok: true, message: "Shift assigned successfully.", count: 1 };
}

/** One guard + one site + many start/end windows (recharge checked on the API including scheduled). */
export async function bulkScheduleShiftsAction(formData: FormData): Promise<ShiftActionResult> {
  const userId = Number(formData.get("userId"));
  const siteId = Number(formData.get("siteId"));
  const count = Number(formData.get("shiftCount") ?? 0);
  if (!userId || !siteId || !count) {
    return failure("Guard, site, and at least one shift are required.");
  }

  const shifts: Array<{ startsAt: string; endsAt: string }> = [];
  for (let i = 0; i < count; i += 1) {
    const startsAt = String(formData.get(`shift_${i}_startsAt`) ?? "");
    const endsAt = String(formData.get(`shift_${i}_endsAt`) ?? "");
    if (!startsAt || !endsAt) continue;
    shifts.push({ startsAt: ukDateTimeLocalToIso(startsAt), endsAt: ukDateTimeLocalToIso(endsAt) });
  }
  if (!shifts.length) {
    return failure("Add at least one shift with start and end times.");
  }

  // The API validates a whole batch before inserting any of it, so chunks are all-or-nothing.
  const CHUNK = 14;
  let saved = 0;
  for (let offset = 0; offset < shifts.length; offset += CHUNK) {
    const chunk = shifts.slice(offset, offset + CHUNK);
    const result = await mutateBackendResult("/shifts/bulk-schedule", "POST", {
      userId,
      siteId,
      shifts: chunk,
      ...(parseForceAssign(formData) ? { force: true } : {}),
    });
    if (!result.ok) {
      if (saved) revalidateShiftPaths(userId, siteId);
      return {
        ok: false,
        count: saved,
        sessionExpired: result.sessionExpired,
        message: saved
          ? `Saved ${saved} of ${shifts.length} shifts, then stopped: ${result.message}`
          : result.message,
      };
    }
    saved += chunk.length;
  }

  revalidateShiftPaths(userId, siteId);
  return {
    ok: true,
    count: saved,
    message: saved === 1 ? "Shift assigned successfully." : `${saved} shifts assigned successfully.`,
  };
}

/** One site + many (guard, start, end) rows. */
export async function assignMultipleSiteShiftsAction(formData: FormData): Promise<ShiftActionResult> {
  const siteId = Number(formData.get("siteId"));
  const count = Number(formData.get("shiftCount") ?? 0);
  if (!siteId || !count) {
    return failure("Site and at least one shift are required.");
  }

  const force = parseForceAssign(formData);
  const userIds = new Set<number>();
  const failedRows: number[] = [];
  const reasons: string[] = [];
  let submitted = 0;
  let saved = 0;
  let sessionExpired = false;

  for (let i = 0; i < count; i += 1) {
    const userId = Number(formData.get(`shift_${i}_userId`));
    const startsAt = String(formData.get(`shift_${i}_startsAt`) ?? "");
    const endsAt = String(formData.get(`shift_${i}_endsAt`) ?? "");
    if (!userId || !startsAt || !endsAt) continue;
    submitted += 1;

    const result = await mutateBackendResult("/shifts", "POST", {
      siteId,
      userId,
      startsAt: ukDateTimeLocalToIso(startsAt),
      endsAt: ukDateTimeLocalToIso(endsAt),
      status: "scheduled",
      ...(force ? { force: true } : {}),
    });

    if (!result.ok) {
      failedRows.push(i);
      reasons.push(`Shift ${i + 1}: ${result.message}`);
      if (result.sessionExpired) {
        sessionExpired = true;
        // Every remaining row would fail the same way; mark them and stop calling out.
        for (let rest = i + 1; rest < count; rest += 1) {
          if (formData.get(`shift_${rest}_userId`)) failedRows.push(rest);
        }
        break;
      }
      continue;
    }

    userIds.add(userId);
    saved += 1;
  }

  if (!submitted) {
    return failure("Add at least one complete shift (times and guard).");
  }

  // Always resync the pages for whatever landed, otherwise the UI keeps showing
  // pre-save data and the next attempt collides with shifts that already exist.
  if (saved) {
    for (const userId of userIds) revalidatePath(`/manager/guards/${userId}`);
    revalidatePath(`/manager/sites/${siteId}`);
    revalidatePath("/manager/shifts");
  }

  if (failedRows.length) {
    return {
      ok: false,
      count: saved,
      sessionExpired,
      failedRows,
      message: saved
        ? `Saved ${saved} of ${submitted} shifts. ${reasons.join(" ")}`
        : reasons.join(" "),
    };
  }

  return {
    ok: true,
    count: saved,
    message: saved === 1 ? "Shift assigned successfully." : `${saved} shifts assigned successfully.`,
  };
}

export async function cancelShiftAction(formData: FormData): Promise<ShiftActionResult> {
  const shiftId = Number(formData.get("id"));
  if (!shiftId) return failure("Shift id is required.");

  const result = await mutateBackendResult(`/shifts/${shiftId}`, "PATCH", { status: "cancelled" });
  if (!result.ok) return failure(result.message, { sessionExpired: result.sessionExpired });

  const guardId = formData.get("guardId");
  const siteId = formData.get("siteId");
  if (guardId) revalidatePath(`/manager/guards/${guardId}`);
  if (siteId) revalidatePath(`/manager/sites/${siteId}`);
  revalidatePath("/manager/shifts");
  return { ok: true, message: "Shift cancelled.", count: 1 };
}

export async function updateShiftAction(formData: FormData): Promise<ShiftActionResult> {
  const id = Number(formData.get("id"));
  const siteId = Number(formData.get("siteId"));
  const userId = Number(formData.get("userId"));
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  const status = String(formData.get("status") ?? "").trim();
  if (!id || !status || !siteId || !userId || !startsAt || !endsAt) {
    return failure("Shift details are incomplete.");
  }

  const result = await mutateBackendResult(`/shifts/${id}`, "PATCH", {
    siteId,
    userId,
    startsAt: ukDateTimeLocalToIso(startsAt),
    endsAt: ukDateTimeLocalToIso(endsAt),
    status,
    ...(parseForceAssign(formData) ? { force: true } : {}),
  });
  if (!result.ok) return failure(result.message, { sessionExpired: result.sessionExpired });

  revalidateShiftPaths(userId, siteId);
  const statusLabel =
    status === "completed"
      ? "Shift updated and marked completed."
      : status === "cancelled"
        ? "Shift updated and cancelled."
        : status === "active"
          ? "Shift updated and marked active."
          : "Shift updated successfully.";
  return { ok: true, message: statusLabel, count: 1 };
}

export async function bulkShiftsAction(formData: FormData): Promise<void> {
  const action = String(formData.get("bulkAction") ?? "");
  const ids = parseBulkIds(formData);
  if (!ids.length) throw new Error("Select at least one shift.");

  const method = action === "delete" ? "DELETE" : action === "cancel" ? "PATCH" : null;
  if (!method) throw new Error("Unknown bulk action.");

  const CONCURRENCY = 5;
  let firstError: Error | null = null;
  for (let i = 0; i < ids.length && !firstError; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((id) =>
        method === "DELETE"
          ? mutateBackend(`/shifts/${id}`, "DELETE")
          : mutateBackend(`/shifts/${id}`, "PATCH", { status: "cancelled" }),
      ),
    );
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    if (rejected) {
      firstError =
        rejected.reason instanceof Error
          ? rejected.reason
          : new Error(String(rejected.reason ?? "Bulk shift update failed"));
    }
  }

  // Revalidate even on partial failure so the table reflects what was changed.
  if (action === "delete") {
    revalidatePath("/manager");
  }
  revalidatePath("/manager/shifts");
  if (firstError) throw firstError;
}

export async function deleteShiftAction(formData: FormData): Promise<ShiftActionResult> {
  const shiftId = Number(formData.get("id"));
  if (!shiftId) return failure("Shift id is required.");

  const result = await mutateBackendResult(`/shifts/${shiftId}`, "DELETE");
  if (!result.ok) return failure(result.message, { sessionExpired: result.sessionExpired });

  const guardId = formData.get("guardId");
  const siteId = formData.get("siteId");
  if (guardId) revalidatePath(`/manager/guards/${guardId}`);
  if (siteId) revalidatePath(`/manager/sites/${siteId}`);
  revalidatePath("/manager/shifts");
  revalidatePath("/manager");
  return { ok: true, message: "Shift deleted.", count: 1 };
}
