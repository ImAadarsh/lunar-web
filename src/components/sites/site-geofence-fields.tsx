"use client";

import {
  Autocomplete,
  GoogleMap,
  Marker,
  Polygon,
  Polyline,
  useJsApiLoader,
  type Libraries,
} from "@react-google-maps/api";
import { useCallback, useMemo, useRef, useState } from "react";

const libraries: Libraries = ["places"];
const defaultCenter = { lat: 53.48, lng: -2.24 };
const mapLoaderId = "lunar-google-maps-site-geofence";

const polygonStyle = {
  fillColor: "#4690bc",
  fillOpacity: 0.25,
  strokeColor: "#082334",
  strokeWeight: 2,
};

export type LatLngPoint = { lat: number; lng: number };

export type SiteGeofenceInitial = {
  name?: string;
  address?: string | null;
  centerLat?: number;
  centerLng?: number;
  geofenceRadiusM?: number | null;
  geofencePolygon?: unknown;
  isActive?: boolean;
};

type SiteGeofenceFieldsProps = {
  initial?: SiteGeofenceInitial;
  showStatus?: boolean;
};

function parsePolygon(raw: unknown): LatLngPoint[] {
  if (raw == null || raw === "") return [];
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(data)) return [];
    return data
      .map((point) => {
        if (point && typeof point === "object") {
          const lat = Number((point as { lat?: number }).lat);
          const lng = Number((point as { lng?: number }).lng);
          if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
        }
        return null;
      })
      .filter((p): p is LatLngPoint => p !== null);
  } catch {
    return [];
  }
}

function pathFromGooglePolygon(polygon: google.maps.Polygon): LatLngPoint[] {
  const path = polygon.getPath();
  return Array.from({ length: path.getLength() }, (_, i) => {
    const p = path.getAt(i);
    return { lat: p.lat(), lng: p.lng() };
  });
}

export function SiteGeofenceFields({ initial, showStatus = false }: SiteGeofenceFieldsProps) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const initialPolygon = useMemo(() => parsePolygon(initial?.geofencePolygon), [initial?.geofencePolygon]);

  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [lat, setLat] = useState(
    initial?.centerLat != null && Number.isFinite(initial.centerLat) ? String(initial.centerLat) : ""
  );
  const [lng, setLng] = useState(
    initial?.centerLng != null && Number.isFinite(initial.centerLng) ? String(initial.centerLng) : ""
  );
  const [radius, setRadius] = useState(
    initial?.geofenceRadiusM != null ? String(initial.geofenceRadiusM) : ""
  );
  const [polygonPath, setPolygonPath] = useState<LatLngPoint[]>(initialPolygon);
  const [polygonJson, setPolygonJson] = useState(
    initialPolygon.length > 0 ? JSON.stringify(initialPolygon) : ""
  );
  const [drawingMode, setDrawingMode] = useState(false);
  const [draftPoints, setDraftPoints] = useState<LatLngPoint[]>([]);

  const polygonRef = useRef<google.maps.Polygon | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: mapLoaderId,
    googleMapsApiKey: key,
    libraries,
  });

  const position =
    lat && lng && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
      ? { lat: Number(lat), lng: Number(lng) }
      : defaultCenter;

  const syncPolygon = useCallback((points: LatLngPoint[]) => {
    setPolygonPath(points);
    const json = points.length > 0 ? JSON.stringify(points) : "";
    setPolygonJson(json);
  }, []);

  const applyPlace = useCallback(() => {
    const place = autocomplete?.getPlace();
    const location = place?.geometry?.location;
    if (!place || !location) return;

    const nextLat = location.lat();
    const nextLng = location.lng();
    if (!name && place.name) setName(place.name);
    setAddress(place.formatted_address ?? place.name ?? address);
    setLat(nextLat.toFixed(6));
    setLng(nextLng.toFixed(6));
  }, [autocomplete, address, name]);

  const onPolygonEdit = useCallback(() => {
    if (polygonRef.current) {
      syncPolygon(pathFromGooglePolygon(polygonRef.current));
    }
  }, [syncPolygon]);

  const clearPolygon = useCallback(() => {
    polygonRef.current?.setMap(null);
    polygonRef.current = null;
    syncPolygon([]);
    setDraftPoints([]);
    setDrawingMode(false);
  }, [syncPolygon]);

  const startDrawing = useCallback(() => {
    setDrawingMode(true);
    setDraftPoints([]);
  }, []);

  const cancelDrawing = useCallback(() => {
    setDrawingMode(false);
    setDraftPoints([]);
  }, []);

  const undoDraftPoint = useCallback(() => {
    setDraftPoints((points) => points.slice(0, -1));
  }, []);

  const finishDrawing = useCallback(() => {
    if (draftPoints.length < 3) return;
    syncPolygon(draftPoints);
    setDraftPoints([]);
    setDrawingMode(false);
  }, [draftPoints, syncPolygon]);

  const onMapClick = useCallback(
    (event: google.maps.MapMouseEvent) => {
      if (!drawingMode) return;
      const next = event.latLng;
      if (!next) return;
      setDraftPoints((points) => [...points, { lat: next.lat(), lng: next.lng() }]);
    },
    [drawingMode]
  );

  const addressInput = (
    <input
      name="address"
      value={address}
      onChange={(event) => setAddress(event.target.value)}
      placeholder="Search address or place name"
      className="lunar-input"
    />
  );

  return (
    <div className="space-y-3">
      <label className="block text-sm text-slate-600">
        Site name
        <input
          name="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Site name"
          className="mt-1 w-full lunar-input"
        />
      </label>

      <label className="block text-sm text-slate-600">
        Location search
        {!key ? (
          <div className="mt-1">{addressInput}</div>
        ) : loadError ? (
          <div className="mt-1 space-y-2">
            {addressInput}
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              Google Maps failed to load. Enable Maps JavaScript API and Places API.
            </p>
          </div>
        ) : isLoaded ? (
          <Autocomplete onLoad={setAutocomplete} onPlaceChanged={applyPlace}>
            <div className="mt-1">{addressInput}</div>
          </Autocomplete>
        ) : (
          <input
            disabled
            placeholder="Loading map search…"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-500"
          />
        )}
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-slate-600">
          Latitude
          <input
            name="centerLat"
            type="number"
            step="any"
            required
            value={lat}
            onChange={(event) => setLat(event.target.value)}
            className="mt-1 w-full tabular-nums lunar-input"
          />
        </label>
        <label className="block text-sm text-slate-600">
          Longitude
          <input
            name="centerLng"
            type="number"
            step="any"
            required
            value={lng}
            onChange={(event) => setLng(event.target.value)}
            className="mt-1 w-full tabular-nums lunar-input"
          />
        </label>
      </div>

      <label className="block text-sm text-slate-600">
        Geofence radius (metres)
        <input
          name="geofenceRadiusM"
          type="number"
          min={1}
          value={radius}
          onChange={(event) => setRadius(event.target.value)}
          placeholder="Optional circular fallback"
          className="mt-1 w-full lunar-input"
        />
      </label>

      {showStatus ? (
        <label className="block text-sm text-slate-600">
          Status
          <select
            name="isActive"
            defaultValue={initial?.isActive === false ? "false" : "true"}
            className="mt-1 w-full lunar-select"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
      ) : null}

      {key && isLoaded ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-700">Geofence area</p>
            <div className="flex flex-wrap gap-2">
              {drawingMode ? (
                <>
                  <button
                    type="button"
                    onClick={undoDraftPoint}
                    disabled={draftPoints.length === 0}
                    className="lunar-btn-secondary lunar-btn-sm disabled:opacity-50"
                  >
                    Undo point
                  </button>
                  <button
                    type="button"
                    onClick={finishDrawing}
                    disabled={draftPoints.length < 3}
                    className="lunar-btn-primary lunar-btn-sm disabled:opacity-50"
                  >
                    Finish ({draftPoints.length} pts)
                  </button>
                  <button type="button" onClick={cancelDrawing} className="lunar-btn-secondary lunar-btn-sm">
                    Cancel
                  </button>
                </>
              ) : (
                <button type="button" onClick={startDrawing} className="lunar-btn-primary lunar-btn-sm">
                  {polygonPath.length >= 3 ? "Redraw boundary" : "Draw boundary"}
                </button>
              )}
              {polygonPath.length > 0 && !drawingMode ? (
                <button type="button" onClick={clearPolygon} className="lunar-btn-secondary lunar-btn-sm">
                  Clear polygon
                </button>
              ) : null}
            </div>
          </div>
          <p className="text-xs text-slate-500">
            {drawingMode
              ? "Click the map to place each corner of the patrol boundary. Use Finish when you have at least 3 points, then drag corners to adjust."
              : "Draw a polygon boundary on the map, or keep a radius above as a simple circular fallback."}
          </p>
          <GoogleMap
            mapContainerClassName={`h-64 w-full rounded-xl border border-slate-200 sm:h-72 ${drawingMode ? "cursor-crosshair" : ""}`}
            center={position}
            zoom={lat && lng ? 16 : 10}
            onClick={onMapClick}
            options={{
              disableDefaultUI: true,
              zoomControl: true,
              mapTypeControl: true,
              streetViewControl: false,
              draggableCursor: drawingMode ? "crosshair" : undefined,
            }}
          >
            {lat && lng && !drawingMode ? (
              <Marker
                position={position}
                draggable
                onDragEnd={(event) => {
                  const next = event.latLng;
                  if (!next) return;
                  setLat(next.lat().toFixed(6));
                  setLng(next.lng().toFixed(6));
                }}
              />
            ) : null}
            {drawingMode && draftPoints.length > 0 ? (
              <Polyline
                path={draftPoints}
                options={{
                  strokeColor: polygonStyle.strokeColor,
                  strokeWeight: 2,
                  strokeOpacity: 0.9,
                }}
              />
            ) : null}
            {drawingMode && draftPoints.length >= 3 ? (
              <Polygon
                path={draftPoints}
                options={{
                  ...polygonStyle,
                  fillOpacity: 0.15,
                  editable: false,
                  draggable: false,
                }}
              />
            ) : null}
            {!drawingMode && polygonPath.length >= 3 ? (
              <Polygon
                path={polygonPath}
                onLoad={(polygon) => {
                  polygonRef.current = polygon;
                }}
                onUnmount={() => {
                  polygonRef.current = null;
                }}
                options={{
                  ...polygonStyle,
                  editable: true,
                  draggable: false,
                }}
                onMouseUp={onPolygonEdit}
                onDragEnd={onPolygonEdit}
              />
            ) : null}
          </GoogleMap>
          {drawingMode ? (
            <p className="text-xs text-sky-700">
              Drawing mode · {draftPoints.length} point{draftPoints.length === 1 ? "" : "s"} placed
              {draftPoints.length < 3 ? " (need at least 3)" : ""}
            </p>
          ) : polygonPath.length > 0 ? (
            <p className="text-xs text-emerald-700">
              Polygon set · {polygonPath.length} point{polygonPath.length === 1 ? "" : "s"} — drag corners to
              adjust
            </p>
          ) : (
            <p className="text-xs text-amber-700">No polygon drawn yet — click Draw boundary to start.</p>
          )}
        </div>
      ) : null}

      <textarea name="geofencePolygon" value={polygonJson} readOnly className="hidden" aria-hidden tabIndex={-1} />

      {!key ? (
        <p className="text-xs text-slate-500">
          Add <code className="text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable map search and polygon
          drawing.
        </p>
      ) : null}
    </div>
  );
}
