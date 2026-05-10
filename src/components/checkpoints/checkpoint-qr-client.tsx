"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckpointQrModal } from "@/components/checkpoints/checkpoint-qr-modal";

type CheckpointRow = { id: number; label: string };

type CheckpointQrClientProps = {
  siteId: number;
  checkpoints: CheckpointRow[];
};

export function CheckpointQrClient({ siteId, checkpoints }: CheckpointQrClientProps) {
  const params = useSearchParams();
  const router = useRouter();
  const selectedId = Number(params.get("qr") ?? "");

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return checkpoints.find((cp) => cp.id === selectedId) ?? null;
  }, [checkpoints, selectedId]);

  if (!selected) return null;

  return (
    <CheckpointQrModal
      checkpoint={{ id: selected.id, label: selected.label }}
      onClose={() => router.push(`/admin/checkpoints?siteId=${siteId}`)}
    />
  );
}

