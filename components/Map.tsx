"use client";

import { useMemo } from "react";
import { Map as MapboxMap, Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { usePins, type Pin } from "@/hooks/usePins";
import { useProfiles, type Profile } from "@/hooks/useProfiles";

const FALLBACK_VIEW = { latitude: 20, longitude: 0, zoom: 1.5 };

export type LatLng = { lat: number; lng: number };

interface Props {
  onMarkerClick?: (pinId: string) => void;
  onMapClick?: (latlng: LatLng) => void;
  pendingLatLng?: LatLng | null;
}

const COLOR_BY_NAME: Record<string, string> = {
  Jade: "#3b82f6", // blue-500
  Frances: "#ec4899", // pink-500
};
const COLOR_DONE = "#10b981"; // emerald-500
const COLOR_FALLBACK = "#71717a"; // zinc-500

function pinColor(
  pin: Pin,
  profilesByUser: Record<string, Profile>,
): string {
  if (pin.is_done) return COLOR_DONE;
  if (!pin.created_by) return COLOR_FALLBACK;
  const profile = profilesByUser[pin.created_by];
  if (!profile) return COLOR_FALLBACK;
  return COLOR_BY_NAME[profile.display_name] ?? COLOR_FALLBACK;
}

function computeCenter(pins: Pin[]) {
  const valid = pins.filter(
    (p): p is Pin & { lat: number; lng: number } =>
      p.lat != null && p.lng != null,
  );
  if (valid.length === 0) return FALLBACK_VIEW;
  const lat = valid.reduce((s, p) => s + p.lat, 0) / valid.length;
  const lng = valid.reduce((s, p) => s + p.lng, 0) / valid.length;
  return { latitude: lat, longitude: lng, zoom: 3 };
}

export default function Map({
  onMarkerClick,
  onMapClick,
  pendingLatLng,
}: Props) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const { data: pins, isLoading, error } = usePins();
  const { data: profiles } = useProfiles();

  const profilesByUser = useMemo(() => {
    const m: Record<string, Profile> = {};
    (profiles ?? []).forEach((p) => {
      m[p.user_id] = p;
    });
    return m;
  }, [profiles]);

  const initialViewState = useMemo(
    () => computeCenter(pins ?? []),
    [pins],
  );

  if (!token) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-zinc-400">
        Missing NEXT_PUBLIC_MAPBOX_TOKEN
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-zinc-400">
        Loading map…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-red-500">
        Failed to load pins: {error.message}
      </div>
    );
  }

  return (
    <MapboxMap
      mapboxAccessToken={token}
      initialViewState={initialViewState}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      style={{ width: "100%", height: "100%" }}
      onClick={(e) => {
        if (!onMapClick) return;
        onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }}
    >
      {(pins ?? []).map((pin) =>
        pin.lat != null && pin.lng != null ? (
          <Marker
            key={pin.id}
            latitude={pin.lat}
            longitude={pin.lng}
            anchor="bottom"
            color={pinColor(pin, profilesByUser)}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onMarkerClick?.(pin.id);
            }}
          />
        ) : null,
      )}

      {pendingLatLng && (
        <Marker
          latitude={pendingLatLng.lat}
          longitude={pendingLatLng.lng}
          anchor="center"
        >
          <div className="h-4 w-4 animate-pulse rounded-full border-2 border-white bg-amber-400 shadow-lg" />
        </Marker>
      )}
    </MapboxMap>
  );
}
