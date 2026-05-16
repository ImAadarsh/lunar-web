"use client";

import { cn } from "@/lib/cn";
import { usePortalFocus } from "@/components/portal/portal-focus-context";

type PortalPageFrameProps = {
  children: React.ReactNode;
  className?: string;
};

export function PortalPageFrame({ children, className }: PortalPageFrameProps) {
  const focus = usePortalFocus();

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col gap-3 overflow-hidden",
        focus ? "h-full max-h-full" : "h-[calc(100dvh-7.5rem)] max-h-[calc(100dvh-7.5rem)] lg:h-full lg:max-h-full",
        className,
      )}
    >
      {children}
    </div>
  );
}
