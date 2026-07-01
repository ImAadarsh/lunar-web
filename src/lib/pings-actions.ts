"use server";

import { revalidatePath } from "next/cache";
import { mutateBackend } from "@/lib/portal-mutations";

const PINGS_PATH = "/manager/pings";

export async function sendShiftChatMessageAction(threadId: number, body: string) {
  const trimmed = body.trim();
  if (!threadId || !trimmed) {
    return { ok: false as const, error: "Message cannot be empty." };
  }

  try {
    await mutateBackend(`/shift-chats/${threadId}/messages`, "POST", { body: trimmed });
    revalidatePath(PINGS_PATH);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Unable to send message." };
  }
}

export async function markShiftChatReadAction(threadId: number) {
  if (!threadId) return { ok: false as const };

  try {
    await mutateBackend(`/shift-chats/${threadId}/read`, "PATCH");
    revalidatePath(PINGS_PATH);
    return { ok: true as const };
  } catch {
    return { ok: false as const };
  }
}
