"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  GoogleMap,
  InfoWindow,
  Marker,
  Polyline,
  useJsApiLoader,
  type Libraries,
} from "@react-google-maps/api";
import { groupOpsMarkersByLocation, opsPinTitle, type OpsMapPin } from "@/lib/ops-map-markers";

export type OpsMarkerDetailLine = { label: string; value: string };

export type OpsMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  type: "shift" | "incident" | "sos" | "telemetry" | "checkpoint";
  title: string;
  details: OpsMarkerDetailLine[];
  actionHref?: string;
  actionLabel?: string;
};

export type OpsTrail = { id: string; points: Array<{ lat: number; lng: number }>; color?: string };

type OperationsMapProps = {
  markers: OpsMarker[];
  trails?: OpsTrail[];
};

const containerStyle: React.CSSProperties = {
  width: "100%",
  height: "520px",
  borderRadius: "16px",
};

const defaultCenter = { lat: 53.4808, lng: -2.2426 };

const libraries: Libraries = ["places"];

const mapOptions: google.maps.MapOptions = {
  clickableIcons: false,
  gestureHandling: "cooperative",
  keyboardShortcuts: false,
  streetViewControl: false,
  mapTypeControl: true,
  fullscreenControl: true,
};

function markerPinColor(type: OpsMarker["type"]): string {
  switch (type) {
    case "sos":
      return "#dc2626";
    case "incident":
      return "#2563eb";
    case "telemetry":
      return "#7c3aed";
    case "checkpoint":
      return "#ca8a04";
    default:
      return "#15803d";
  }
}

function MarkerDetailBlock({ item }: { item: OpsMarker }) {
  return (
    <section className={item.actionHref ? "pb-3" : ""}>
      <p className="ops-map-infowindow__title text-sm font-bold leading-snug">{item.title}</p>
      <dl className="mt-2 space-y-1.5 text-xs">
        {item.details.map((line) => (
          <div key={`${item.id}-${line.label}`}>
            <dt className="ops-map-infowindow__label font-semibold">{line.label}</dt>
            <dd className="ops-map-infowindow__value">{line.value}</dd>
          </div>
        ))}
      </dl>
      {item.actionHref ? (
        <Link
          href={item.actionHref}
          className="ops-map-infowindow__link mt-2 inline-block text-xs font-semibold underline"
        >
          {item.actionLabel ?? "View details"}
        </Link>
      ) : null}
    </section>
  );
}

function PinInfoContent({ pin }: { pin: OpsMapPin }) {
  if (pin.count === 1) {
    return (
      <div className="ops-map-infowindow max-w-[280px] p-1">
        <MarkerDetailBlock item={pin.items[0]} />
      </div>
    );
  }

  return (
    <div className="ops-map-infowindow max-w-[300px] p-1">
      <p className="ops-map-infowindow__title text-sm font-bold leading-snug">{opsPinTitle(pin)}</p>
      <p className="ops-map-infowindow__label mt-1 text-xs">Tap a row below — same map pin, multiple records.</p>
      <div className="mt-3 max-h-[320px] space-y-3 overflow-y-auto pr-1">
        {pin.items.map((item, index) => (
          <div
            key={item.id}
            className={index > 0 ? "border-t border-slate-200 pt-3" : undefined}
          >
            <MarkerDetailBlock item={item} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function OperationsMap({ markers, trails = [] }: OperationsMapProps) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const pins = useMemo(() => groupOpsMarkersByLocation(markers), [markers]);
  const { isLoaded, loadError } = useJsApiLoader({
    id: "lunar-google-maps",
    googleMapsApiKey: key,
    libraries,
  });

  const selectedPin = useMemo(
    () => pins.find((p) => p.id === selectedPinId) ?? null,
    [pins, selectedPinId],
  );

  const handleMapClick = useCallback(() => {
    setSelectedPinId(null);
  }, []);

  if (!key) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in <code>.env.local</code> to enable map rendering.
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Google Maps failed to load.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading map…</div>
    );
  }

  const center =
    pins.length > 0
      ? {
          lat: pins.reduce((sum, p) => sum + p.lat, 0) / pins.length,
          lng: pins.reduce((sum, p) => sum + p.lng, 0) / pins.length,
        }
      : defaultCenter;

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={pins.length === 1 ? 13 : 11}
      options={mapOptions}
      onClick={handleMapClick}
    >
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          position={{ lat: pin.lat, lng: pin.lng }}
          title={opsPinTitle(pin)}
          onClick={(event) => {
            event.domEvent?.stopPropagation?.();
            setSelectedPinId(pin.id);
          }}
          label={
            pin.count > 1
              ? {
                  text: String(pin.count),
                  color: "#ffffff",
                  fontWeight: "700",
                  fontSize: "11px",
                }
              : undefined
          }
          icon={
            typeof google !== "undefined"
              ? {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: pin.count > 1 ? 14 : 10,
                  fillColor: markerPinColor(pin.type),
                  fillOpacity: 1,
                  strokeColor: "#ffffff",
                  strokeWeight: 2,
                }
              : undefined
          }
        />
      ))}
      {trails.map((trail) => (
        <Polyline
          key={trail.id}
          path={trail.points}
          options={{ strokeColor: trail.color ?? "#7c3aed", strokeOpacity: 0.75, strokeWeight: 4, clickable: false }}
        />
      ))}
      {selectedPin ? (
        <InfoWindow
          position={{ lat: selectedPin.lat, lng: selectedPin.lng }}
          onCloseClick={() => setSelectedPinId(null)}
        >
          <PinInfoContent pin={selectedPin} />
        </InfoWindow>
      ) : null}
    </GoogleMap>
  );
}
