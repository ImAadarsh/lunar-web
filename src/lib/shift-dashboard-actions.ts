"use server";

import { revalidatePath } from "next/cache";
import { mutateBackend } from "@/lib/portal-mutations";
import { parseBulkIds } from "@/lib/portal-table";
import { ukDateTimeLocalToIso } from "@/lib/uk-datetime";

export type ShiftActionResult = {
  ok: true;
  message: string;
  count?: number;
};

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
    throw new Error("Site, guard, start, and end time are required.");
  }

  await mutateBackend("/shifts", "POST", {
    siteId,
    userId,
    startsAt: ukDateTimeLocalToIso(startsAt),
    endsAt: ukDateTimeLocalToIso(endsAt),
    status: "scheduled",
    ...(parseForceAssign(formData) ? { force: true } : {}),
  });

  revalidateShiftPaths(userId, siteId);
  return { ok: true, message: "Shift assigned successfully.", count: 1 };
}

/** One guard + one site + many start/end windows (recharge checked on the API including scheduled). */
export async function bulkScheduleShiftsAction(formData: FormData): Promise<ShiftActionResult> {
  const userId = Number(formData.get("userId"));
  const siteId = Number(formData.get("siteId"));
  const count = Number(formData.get("shiftCount") ?? 0);
  if (!userId || !siteId || !count) {
    throw new Error("Guard, site, and at least one shift are required.");
  }

  const shifts: Array<{ startsAt: string; endsAt: string }> = [];
  for (let i = 0; i < count; i += 1) {
    const startsAt = String(formData.get(`shift_${i}_startsAt`) ?? "");
    const endsAt = String(formData.get(`shift_${i}_endsAt`) ?? "");
    if (!startsAt || !endsAt) continue;
    shifts.push({ startsAt: ukDateTimeLocalToIso(startsAt), endsAt: ukDateTimeLocalToIso(endsAt) });
  }
  if (!shifts.length) {
    throw new Error("Add at least one shift with start and end times.");
  }

  const CHUNK = 14;
  for (let offset = 0; offset < shifts.length; offset += CHUNK) {
    const chunk = shifts.slice(offset, offset + CHUNK);
    await mutateBackend("/shifts/bulk-schedule", "POST", {
      userId,
      siteId,
      shifts: chunk,
      ...(parseForceAssign(formData) ? { force: true } : {}),
    });
  }

  revalidateShiftPaths(userId, siteId);
  const n = shifts.length;
  return {
    ok: true,
    message: n === 1 ? "Shift assigned successfully." : `${n} shifts assigned successfully.`,
    count: n,
  };
}

/** One site + many (guard, start, end) rows. */
export async function assignMultipleSiteShiftsAction(formData: FormData): Promise<ShiftActionResult> {
  const siteId = Number(formData.get("siteId"));
  const count = Number(formData.get("shiftCount") ?? 0);
  if (!siteId || !count) {
    throw new Error("Site and at least one shift are required.");
  }

  const force = parseForceAssign(formData);
  const userIds = new Set<number>();
  let saved = 0;

  for (let i = 0; i < count; i += 1) {
    const userId = Number(formData.get(`shift_${i}_userId`));
    const startsAt = String(formData.get(`shift_${i}_startsAt`) ?? "");
    const endsAt = String(formData.get(`shift_${i}_endsAt`) ?? "");
    if (!userId || !startsAt || !endsAt) continue;
    await mutateBackend("/shifts", "POST", {
      siteId,
      userId,
      startsAt: ukDateTimeLocalToIso(startsAt),
      endsAt: ukDateTimeLocalToIso(endsAt),
      status: "scheduled",
      ...(force ? { force: true } : {}),
    });
    userIds.add(userId);
    saved += 1;
  }

  if (!saved) {
    throw new Error("Add at least one complete shift (times and guard).");
  }

  for (const userId of userIds) revalidatePath(`/manager/guards/${userId}`);
  revalidatePath(`/manager/sites/${siteId}`);
  revalidatePath("/manager/shifts");

  return {
    ok: true,
    message: saved === 1 ? "Shift assigned successfully." : `${saved} shifts assigned successfully.`,
    count: saved,
  };
}

export async function cancelShiftAction(formData: FormData): Promise<ShiftActionResult> {
  const shiftId = Number(formData.get("id"));
  if (!shiftId) throw new Error("Shift id is required.");

  await mutateBackend(`/shifts/${shiftId}`, "PATCH", { status: "cancelled" });

  const guardId = formData.get("guardId");
  const siteId = formData.get("siteId");
  if (guardId) revalidatePath(`/manager/guards/${guardId}`);
  if (siteId) revalidatePath(`/manager/sites/${siteId}`);
  revalidatePath("/manager/shifts");
  return { ok: true, message: "Shift cancelled." };
}

export async function updateShiftAction(formData: FormData): Promise<ShiftActionResult> {
  const id = Number(formData.get("id"));
  const siteId = Number(formData.get("siteId"));
  const userId = Number(formData.get("userId"));
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  const status = String(formData.get("status") ?? "").trim();
  if (!id || !status || !siteId || !userId || !startsAt || !endsAt) {
    throw new Error("Shift details are incomplete.");
  }

  await mutateBackend(`/shifts/${id}`, "PATCH", {
    siteId,
    userId,
    startsAt: ukDateTimeLocalToIso(startsAt),
    endsAt: ukDateTimeLocalToIso(endsAt),
    status,
    ...(parseForceAssign(formData) ? { force: true } : {}),
  });

  revalidateShiftPaths(userId, siteId);
  const statusLabel =
    status === "completed"
      ? "Shift updated and marked completed."
      : status === "cancelled"
        ? "Shift updated and cancelled."
        : status === "active"
          ? "Shift updated and marked active."
          : "Shift updated successfully.";
  return { ok: true, message: statusLabel };
}

export async function bulkShiftsAction(formData: FormData): Promise<void> {
  const action = String(formData.get("bulkAction") ?? "");
  const ids = parseBulkIds(formData);
  if (!ids.length) throw new Error("Select at least one shift.");

  const method = action === "delete" ? "DELETE" : action === "cancel" ? "PATCH" : null;
  if (!method) throw new Error("Unknown bulk action.");

  const CONCURRENCY = 5;
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((id) =>
        method === "DELETE"
          ? mutateBackend(`/shifts/${id}`, "DELETE")
          : mutateBackend(`/shifts/${id}`, "PATCH", { status: "cancelled" }),
      ),
    );
    const firstError = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    if (firstError) {
      throw firstError.reason instanceof Error
        ? firstError.reason
        : new Error(String(firstError.reason ?? "Bulk shift update failed"));
    }
  }

  if (action === "delete") {
    revalidatePath("/manager");
  }
  revalidatePath("/manager/shifts");
}

export async function deleteShiftAction(formData: FormData): Promise<ShiftActionResult> {
  const shiftId = Number(formData.get("id"));
  if (!shiftId) throw new Error("Shift id is required.");

  await mutateBackend(`/shifts/${shiftId}`, "DELETE");

  const guardId = formData.get("guardId");
  const siteId = formData.get("siteId");
  if (guardId) revalidatePath(`/manager/guards/${guardId}`);
  if (siteId) revalidatePath(`/manager/sites/${siteId}`);
  revalidatePath("/manager/shifts");
  revalidatePath("/manager");
  return { ok: true, message: "Shift deleted." };
}
