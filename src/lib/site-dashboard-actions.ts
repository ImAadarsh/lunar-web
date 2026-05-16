"use server";

import { revalidatePath } from "next/cache";
import { mutateBackend } from "@/lib/portal-mutations";

function revalidateSite(siteId: number, userId?: number) {
  revalidatePath(`/manager/sites/${siteId}`);
  if (userId) revalidatePath(`/manager/guards/${userId}`);
  revalidatePath("/manager/training");
  revalidatePath("/manager/shifts");
}

export async function addSiteTrainingAction(formData: FormData) {
  const siteId = Number(formData.get("siteId"));
  const userIds = formData
    .getAll("userIds")
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);
  const trainedOn = String(formData.get("trainedOn") ?? "").trim();
  if (!siteId || !userIds.length) return;

  await mutateBackend("/training/assignments/bulk", "POST", {
    userIds,
    siteIds: [siteId],
    trainedOn: trainedOn || undefined,
  });

  revalidateSite(siteId);
}

export async function removeSiteTrainingAction(formData: FormData) {
  const siteId = Number(formData.get("siteId"));
  const trainingId = Number(formData.get("trainingId"));
  const userId = Number(formData.get("userId"));
  if (!trainingId) return;

  await mutateBackend(`/training/assignments/${trainingId}`, "DELETE");

  revalidateSite(siteId, userId || undefined);
}

export async function updateSiteTrainingAction(formData: FormData) {
  const siteId = Number(formData.get("siteId"));
  const trainingId = Number(formData.get("trainingId"));
  const userId = Number(formData.get("userId"));
  const trainedOn = String(formData.get("trainedOn") ?? "").trim();
  if (!trainingId) return;

  await mutateBackend(`/training/assignments/${trainingId}`, "PATCH", {
    trainedOn: trainedOn || undefined,
  });

  revalidateSite(siteId, userId || undefined);
}

export async function assignGuardAtSiteAction(formData: FormData) {
  const userId = Number(formData.get("userId"));
  const siteId = Number(formData.get("siteId"));
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  if (!userId || !siteId || !startsAt || !endsAt) return;

  await mutateBackend("/shifts", "POST", {
    siteId,
    userId,
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(endsAt).toISOString(),
    status: "scheduled",
  });

  revalidateSite(siteId, userId);
}
