"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  variant?: "primary" | "secondary" | "danger";
};

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  className,
  variant = "primary",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const variantClass =
    variant === "danger" ? "lunar-btn-danger" : variant === "secondary" ? "lunar-btn-secondary" : "lunar-btn-primary";

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(variantClass, "w-full", pending && "lunar-shimmer", className)}
    >
      {pending ? (
        <>
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
