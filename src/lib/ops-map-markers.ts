import type { OpsMarker } from "@/components/operations/operations-map";

export type OpsMapPin = {
  id: string;
  lat: number;
  lng: number;
  type: OpsMarker["type"];
  count: number;
  items: OpsMarker[];
};

const TYPE_PRIORITY: Record<OpsMarker["type"], number> = {
  sos: 5,
  incident: 4,
  telemetry: 3,
  checkpoint: 2,
  shift: 1,
};

function locationKey(lat: number, lng: number) {
  return `${lat.toFixed(6)}:${lng.toFixed(6)}`;
}

/** Merge markers that share the same coordinates (e.g. multiple shifts at one site). */
export function groupOpsMarkersByLocation(markers: OpsMarker[]): OpsMapPin[] {
  const buckets = new Map<string, OpsMarker[]>();

  for (const marker of markers) {
    const key = locationKey(marker.lat, marker.lng);
    const list = buckets.get(key) ?? [];
    list.push(marker);
    buckets.set(key, list);
  }

  return [...buckets.entries()].map(([key, items]) => {
    const primary = [...items].sort((a, b) => TYPE_PRIORITY[b.type] - TYPE_PRIORITY[a.type])[0];
    return {
      id: `pin-${key}`,
      lat: primary.lat,
      lng: primary.lng,
      type: primary.type,
      count: items.length,
      items,
    };
  });
}

export function opsPinTitle(pin: OpsMapPin): string {
  if (pin.count === 1) return pin.items[0].title;
  const byType = countByType(pin.items);
  const parts = Object.entries(byType).map(([type, n]) => {
    const label = type === "shift" ? "shift" : type === "incident" ? "incident" : type;
    return `${n} ${label}${n === 1 ? "" : "s"}`;
  });
  return `${pin.count} at this location (${parts.join(", ")})`;
}

function countByType(items: OpsMarker[]) {
  const out: Partial<Record<OpsMarker["type"], number>> = {};
  for (const item of items) {
    out[item.type] = (out[item.type] ?? 0) + 1;
  }
  return out as Record<OpsMarker["type"], number>;
}
