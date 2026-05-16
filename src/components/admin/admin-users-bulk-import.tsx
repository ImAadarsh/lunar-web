"use client";

import Link from "next/link";
import { useRef, useState } from "react";

const SAMPLE_PATH = "/users-import-sample.csv";

type AdminUsersBulkImportProps = {
  action: (formData: FormData) => void | Promise<void>;
  lastResult?: {
    created: number;
    failed: number;
    messages?: string[];
  };
};

export function AdminUsersBulkImport({ action, lastResult }: AdminUsersBulkImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--portal-text-muted)]">
        Upload a CSV with one user per row. Required columns:{" "}
        <code className="rounded bg-[var(--portal-surface-muted)] px-1">email</code>,{" "}
        <code className="rounded bg-[var(--portal-surface-muted)] px-1">password</code>,{" "}
        <code className="rounded bg-[var(--portal-surface-muted)] px-1">role</code>. For guards, include{" "}
        <code className="rounded bg-[var(--portal-surface-muted)] px-1">full_name</code>.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={SAMPLE_PATH} download className="lunar-btn-secondary lunar-btn-sm">
          Download sample CSV
        </Link>
        <a href={SAMPLE_PATH} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-lunar-700 hover:underline">
          Preview sample
        </a>
      </div>

      <form action={action} className="space-y-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--portal-text)]">CSV file</span>
          <input
            ref={inputRef}
            name="csvFile"
            type="file"
            accept=".csv,text/csv"
            required
            className="lunar-input file:mr-3 file:rounded-md file:border-0 file:bg-lunar-700 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
          />
          {fileName ? <span className="text-xs text-[var(--portal-text-muted)]">{fileName}</span> : null}
        </label>
        <button type="submit" className="lunar-btn-primary w-full">
          Import users from CSV
        </button>
      </form>

      {lastResult ? (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            lastResult.failed > 0
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          <p>
            Imported <strong>{lastResult.created}</strong> user{lastResult.created === 1 ? "" : "s"}
            {lastResult.failed > 0 ? (
              <>
                ; <strong>{lastResult.failed}</strong> failed
              </>
            ) : null}
            .
          </p>
          {lastResult.messages?.length ? (
            <ul className="mt-2 max-h-32 list-inside list-disc overflow-y-auto text-xs">
              {lastResult.messages.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
