"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type Checkpoint = {
  id: number;
  label: string;
};

type CheckpointQrModalProps = {
  checkpoint: Checkpoint;
  onClose: () => void;
};

export function CheckpointQrModal({ checkpoint, onClose }: CheckpointQrModalProps) {
  const payload = useMemo(() => String(checkpoint.id), [checkpoint.id]);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(payload, {
      margin: 2,
      width: 720,
      errorCorrectionLevel: "M",
      color: { dark: "#0b2a3a", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  function downloadPng() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `checkpoint-${checkpoint.id}.png`;
    a.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-lunar-600">Checkpoint QR</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">
              #{checkpoint.id} • {checkpoint.label}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              QR payload is the numeric checkpoint ID to match the guard app scanner.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt={`QR for checkpoint ${checkpoint.id}`} className="mx-auto w-80 max-w-full" />
          ) : (
            <div className="text-center text-sm text-slate-600">Generating QR…</div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <code className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">payload: {payload}</code>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Print
            </button>
            <button
              type="button"
              onClick={downloadPng}
              disabled={!dataUrl}
              className="rounded-md bg-lunar-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lunar-800 disabled:opacity-60"
            >
              Download PNG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

