"use client";

import { Autocomplete, GoogleMap, Marker, useJsApiLoader, type Libraries } from "@react-google-maps/api";
import { useState } from "react";

const libraries: Libraries = ["places"];
const defaultCenter = { lat: 51.5074, lng: -0.1278 };

export function CheckpointPlaceFields() {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [label, setLabel] = useState("");
  const [searchAddress, setSearchAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const position = lat && lng ? { lat: Number(lat), lng: Number(lng) } : defaultCenter;

  const { isLoaded, loadError } = useJsApiLoader({
    id: "lunar-google-maps",
    googleMapsApiKey: key,
    libraries,
  });

  function applyPlace() {
    const place = autocomplete?.getPlace();
    const location = place?.geometry?.location;
    if (!place || !location) return;

    if (!label && place.name) setLabel(place.name);
    setSearchAddress(place.formatted_address ?? place.name ?? searchAddress);
    setLat(location.lat().toFixed(6));
    setLng(location.lng().toFixed(6));
  }

  const searchInput = (
    <input
      value={searchAddress}
      onChange={(event) => setSearchAddress(event.target.value)}
      placeholder="Search checkpoint address or place"
      className="lunar-input"
    />
  );

  return (
    <div className="space-y-3">
      {!key ? (
        searchInput
      ) : loadError ? (
        <div className="space-y-2">
          {searchInput}
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            Google Maps failed to load. Check that Maps JavaScript API and Places API are enabled.
          </p>
        </div>
      ) : isLoaded ? (
        <Autocomplete onLoad={setAutocomplete} onPlaceChanged={applyPlace}>
          {searchInput}
        </Autocomplete>
      ) : (
        <input
          disabled
          placeholder="Loading Google address search..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-500"
        />
      )}
      <input
        name="label"
        required
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder="Checkpoint label"
        className="lunar-input"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          name="lat"
          type="number"
          step="any"
          required
          value={lat}
          onChange={(event) => setLat(event.target.value)}
          placeholder="Latitude"
          className="lunar-input"
        />
        <input
          name="lng"
          type="number"
          step="any"
          required
          value={lng}
          onChange={(event) => setLng(event.target.value)}
          placeholder="Longitude"
          className="lunar-input"
        />
      </div>
      {key && isLoaded ? (
        <GoogleMap
          mapContainerClassName="h-48 w-full rounded-xl border border-slate-200"
          center={position}
          zoom={lat && lng ? 17 : 10}
          options={{ disableDefaultUI: true, zoomControl: true }}
        >
          {lat && lng ? <Marker position={position} /> : null}
        </GoogleMap>
      ) : null}
      <p className="text-xs text-slate-500">
        Choose a Google suggestion to fill checkpoint label and coordinates, or enter coordinates manually.
      </p>
    </div>
  );
}
