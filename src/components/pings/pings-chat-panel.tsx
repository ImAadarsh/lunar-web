import { PingsChatClient } from "@/components/pings/pings-chat-client";
import type { ShiftChatMessage, ShiftChatThreadDetail } from "@/lib/pings-types";

type PingsChatPanelProps = {
  thread: ShiftChatThreadDetail | null;
  initialMessages: ShiftChatMessage[];
  currentUserId: number;
};

export function PingsChatPanel({ thread, initialMessages, currentUserId }: PingsChatPanelProps) {
  if (!thread) {
    return (
      <section className="flex min-h-[16rem] flex-1 flex-col items-center justify-center p-8 text-center lg:min-h-0">
        <p className="text-lg font-medium text-[var(--portal-text)]">Select a shift thread</p>
        <p className="mt-1 max-w-sm text-sm text-[var(--portal-text-muted)]">
          Choose a guard shift from the list to view pings, location shares, and messages.
        </p>
      </section>
    );
  }

  return (
    <section className="flex min-h-[20rem] min-w-0 flex-1 flex-col overflow-hidden lg:min-h-0">
      <PingsChatClient thread={thread} initialMessages={initialMessages} currentUserId={currentUserId} />
    </section>
  );
}
