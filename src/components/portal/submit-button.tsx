"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
};

export function SubmitButton({ children, pendingLabel = "Saving...", className }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      disabled={pending}
      className={
        className ??
        "w-full rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lunar-800 disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
