"use server";

import { revalidatePath } from "next/cache";
import { mutateBackend } from "@/lib/portal-mutations";
import { parseBulkIds } from "@/lib/portal-table";
import { backendApiWithSession } from "@/lib/backend";
import { getSessionFromCookies } from "@/lib/server-session";
import { ukDateTimeLocalToIso } from "@/lib/uk-datetime";

function parseForceAssign(formData: FormData) {
  return formData.get("force") === "1" || formData.get("force") === "on";
}

export async function assignGuardShiftAction(formData: FormData) {
  const userId = Number(formData.get("userId"));
  const siteId = Number(formData.get("siteId"));
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  if (!userId || !siteId || !startsAt || !endsAt) return;

  await mutateBackend("/shifts", "POST", {
    siteId,
    userId,
    startsAt: ukDateTimeLocalToIso(startsAt),
    endsAt: ukDateTimeLocalToIso(endsAt),
    status: "scheduled",
    ...(parseForceAssign(formData) ? { force: true } : {}),
  });

  revalidatePath(`/manager/guards/${userId}`);
  revalidatePath(`/manager/sites/${siteId}`);
  revalidatePath("/manager/shifts");
}

export async function bulkScheduleShiftsAction(formData: FormData) {
  const userId = Number(formData.get("userId"));
  const siteId = Number(formData.get("siteId"));
  const count = Number(formData.get("shiftCount") ?? 0);
  if (!userId || !siteId || !count) return;

  const shifts: Array<{ startsAt: string; endsAt: string }> = [];
  for (let i = 0; i < count; i += 1) {
    const startsAt = String(formData.get(`shift_${i}_startsAt`) ?? "");
    const endsAt = String(formData.get(`shift_${i}_endsAt`) ?? "");
    if (!startsAt || !endsAt) continue;
    shifts.push({ startsAt: ukDateTimeLocalToIso(startsAt), endsAt: ukDateTimeLocalToIso(endsAt) });
  }
  if (!shifts.length) return;

  await mutateBackend("/shifts/bulk-schedule", "POST", {
    userId,
    siteId,
    shifts,
    ...(parseForceAssign(formData) ? { force: true } : {}),
  });

  revalidatePath(`/manager/guards/${userId}`);
  revalidatePath(`/manager/sites/${siteId}`);
  revalidatePath("/manager/shifts");
}

export async function cancelShiftAction(formData: FormData) {
  const shiftId = Number(formData.get("id"));
  if (!shiftId) return;

  await mutateBackend(`/shifts/${shiftId}`, "PATCH", { status: "cancelled" });

  const guardId = formData.get("guardId");
  const siteId = formData.get("siteId");
  if (guardId) revalidatePath(`/manager/guards/${guardId}`);
  if (siteId) revalidatePath(`/manager/sites/${siteId}`);
  revalidatePath("/manager/shifts");
}

export async function updateShiftAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const siteId = Number(formData.get("siteId"));
  const userId = Number(formData.get("userId"));
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  const status = String(formData.get("status") ?? "").trim();
  if (!id || !status || !siteId || !userId || !startsAt || !endsAt) return;

  const session = await getSessionFromCookies();
  if (!session) return;

  type ShiftsResponse = { items: Array<{ id: number; userId: number }> };
  type DutyRosterResponse = {
    items: Array<{ userId: number; availability: { canAssign?: boolean } }>;
  };

  const [shiftsRes, rosterRes] = await Promise.all([
    backendApiWithSession<ShiftsResponse>("/shifts", session),
    backendApiWithSession<DutyRosterResponse>("/duty/roster", session),
  ]);
  const existing = shiftsRes.data?.items.find((s) => s.id === id);
  const sameGuard = existing && existing.userId === userId;
  if (!sameGuard) {
    const row = rosterRes.data?.items.find((r) => r.userId === userId);
    if (!row?.availability.canAssign) return;
  }

  await mutateBackend(`/shifts/${id}`, "PATCH", {
    siteId,
    userId,
    startsAt: ukDateTimeLocalToIso(startsAt),
    endsAt: ukDateTimeLocalToIso(endsAt),
    status,
    ...(parseForceAssign(formData) ? { force: true } : {}),
  });

  revalidatePath(`/manager/guards/${userId}`);
  revalidatePath(`/manager/sites/${siteId}`);
  revalidatePath("/manager/shifts");
}

export async function bulkShiftsAction(formData: FormData) {
  const action = String(formData.get("bulkAction") ?? "");
  const ids = parseBulkIds(formData);
  if (!ids.length) return;

  if (action === "cancel") {
    for (const id of ids) {
      await mutateBackend(`/shifts/${id}`, "PATCH", { status: "cancelled" });
    }
  } else if (action === "delete") {
    for (const id of ids) {
      await mutateBackend(`/shifts/${id}`, "DELETE");
    }
    revalidatePath("/manager");
  } else {
    return;
  }

  revalidatePath("/manager/shifts");
}

export async function deleteShiftAction(formData: FormData) {
  const shiftId = Number(formData.get("id"));
  if (!shiftId) return;

  await mutateBackend(`/shifts/${shiftId}`, "DELETE");

  const guardId = formData.get("guardId");
  const siteId = formData.get("siteId");
  if (guardId) revalidatePath(`/manager/guards/${guardId}`);
  if (siteId) revalidatePath(`/manager/sites/${siteId}`);
  revalidatePath("/manager/shifts");
  revalidatePath("/manager");
}
