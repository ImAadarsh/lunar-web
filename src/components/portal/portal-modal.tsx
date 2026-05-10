"use client";

import { useState } from "react";

type PortalModalProps = {
  triggerLabel: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  triggerClassName?: string;
};

export function PortalModal({
  triggerLabel,
  title,
  description,
  children,
  triggerClassName,
}: PortalModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "inline-flex rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lunar-800"
        }
      >
        {triggerLabel}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                aria-label="Close modal"
              >
                Close
              </button>
            </div>
            <div className="p-5">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
