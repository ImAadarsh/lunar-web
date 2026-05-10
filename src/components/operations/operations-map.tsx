"use client";

import { GoogleMap, Marker, Polyline, useJsApiLoader, type Libraries } from "@react-google-maps/api";

export type OpsMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  type: "shift" | "incident" | "sos" | "telemetry" | "checkpoint";
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

const defaultCenter = { lat: 51.5074, lng: -0.1278 };
const libraries: Libraries = ["places"];

export function OperationsMap({ markers, trails = [] }: OperationsMapProps) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "lunar-google-maps",
    googleMapsApiKey: key,
    libraries,
  });

  if (!key) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in <code>.env.local</code> to enable map rendering.
      </div>
    );
  }

  if (loadError) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Google Maps failed to load.</div>;
  }

  if (!isLoaded) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading map...</div>;
  }

  const center =
    markers.length > 0
      ? {
          lat: markers.reduce((sum, m) => sum + m.lat, 0) / markers.length,
          lng: markers.reduce((sum, m) => sum + m.lng, 0) / markers.length,
        }
      : defaultCenter;

  return (
    <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={11}>
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={{ lat: marker.lat, lng: marker.lng }}
          label={{
            text: marker.label,
            color: marker.type === "sos" ? "#b91c1c" : marker.type === "incident" ? "#1d4ed8" : marker.type === "telemetry" ? "#7c3aed" : "#15803d",
            fontWeight: "700",
            fontSize: "12px",
          }}
        />
      ))}
      {trails.map((trail) => (
        <Polyline
          key={trail.id}
          path={trail.points}
          options={{ strokeColor: trail.color ?? "#7c3aed", strokeOpacity: 0.75, strokeWeight: 4 }}
        />
      ))}
    </GoogleMap>
  );
}

