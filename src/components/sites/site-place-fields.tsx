"use client";

import { Autocomplete, GoogleMap, Marker, useJsApiLoader, type Libraries } from "@react-google-maps/api";
import { useState } from "react";

const libraries: Libraries = ["places"];
const defaultCenter = { lat: 51.5074, lng: -0.1278 };

export function SitePlaceFields() {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
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

    const nextLat = location.lat();
    const nextLng = location.lng();
    if (!name && place.name) setName(place.name);
    setAddress(place.formatted_address ?? place.name ?? address);
    setLat(nextLat.toFixed(6));
    setLng(nextLng.toFixed(6));
  }

  const addressInput = (
    <input
      name="address"
      value={address}
      onChange={(event) => setAddress(event.target.value)}
      placeholder="Start typing address or place name"
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
    />
  );

  return (
    <div className="space-y-3">
      <input
        name="name"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Site name"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
      />
      {!key ? (
        addressInput
      ) : loadError ? (
        <div className="space-y-2">
          {addressInput}
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            Google Maps failed to load. Check that Maps JavaScript API and Places API are enabled.
          </p>
        </div>
      ) : isLoaded ? (
        <Autocomplete onLoad={setAutocomplete} onPlaceChanged={applyPlace}>
          {addressInput}
        </Autocomplete>
      ) : (
        <input
          disabled
          placeholder="Loading Google address search..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-500"
        />
      )}
      <div className="grid grid-cols-2 gap-2">
        <input
          name="centerLat"
          type="number"
          step="any"
          required
          value={lat}
          onChange={(event) => setLat(event.target.value)}
          placeholder="Latitude"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
        />
        <input
          name="centerLng"
          type="number"
          step="any"
          required
          value={lng}
          onChange={(event) => setLng(event.target.value)}
          placeholder="Longitude"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-lunar-400"
        />
      </div>
      {key && isLoaded ? (
        <GoogleMap
          mapContainerClassName="h-56 w-full rounded-xl border border-slate-200"
          center={position}
          zoom={lat && lng ? 15 : 10}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
          }}
        >
          {lat && lng ? <Marker position={position} /> : null}
        </GoogleMap>
      ) : null}
      <p className="text-xs text-slate-500">
        Pick a Google suggestion to auto-fill address and coordinates, or enter latitude/longitude manually.
      </p>
    </div>
  );
}
