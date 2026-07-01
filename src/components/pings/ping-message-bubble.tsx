import type { ShiftChatMessage } from "@/lib/pings-types";
import { cn } from "@/lib/cn";

type PingMessageBubbleProps = {
  message: ShiftChatMessage;
  isOwnMessage: boolean;
};

export function PingMessageBubble({ message, isOwnMessage }: PingMessageBubbleProps) {
  const isPing = message.messageType === "ping";
  const hasCoords = message.lat != null && message.lng != null;
  const mapHref = hasCoords ? `https://www.google.com/maps?q=${message.lat},${message.lng}` : null;

  return (
    <div className={cn("flex", isOwnMessage ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          isPing
            ? "border border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100"
            : isOwnMessage
              ? "bg-lunar-700 text-white"
              : "border border-[var(--portal-border)] bg-[var(--portal-table-row-hover)]/60 text-[var(--portal-text)]",
        )}
      >
        {!isOwnMessage && message.senderName ? (
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">{message.senderName}</p>
        ) : null}
        {isPing ? (
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 font-semibold">
              <span aria-hidden>📍</span>
              Location ping
            </p>
            {message.body ? <p className="text-sm">{message.body}</p> : null}
            {hasCoords ? (
              <p className="font-mono text-xs opacity-80">
                {Number(message.lat).toFixed(5)}, {Number(message.lng).toFixed(5)}
              </p>
            ) : null}
            {mapHref ? (
              <a
                href={mapHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2 hover:opacity-80"
              >
                Open in Google Maps
              </a>
            ) : null}
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words">{message.body ?? ""}</p>
        )}
      </div>
    </div>
  );
}
