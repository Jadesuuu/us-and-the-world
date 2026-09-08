"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import {
  Map as MapboxMap,
  Marker,
  type MapRef,
} from "react-map-gl/mapbox";
// Note: mapbox-gl itself is deliberately NOT imported statically here.
// react-map-gl lazy-loads it on mount, which keeps its 460 KB (gz) parse
// off the hydration critical path. Measured: a static import moved the
// first frame no earlier and added ~250 ms of main-thread blocking.
import "mapbox-gl/dist/mapbox-gl.css";
import { usePins, type Pin } from "@/hooks/usePins";
import { useProfiles, type Profile } from "@/hooks/useProfiles";
import { useTheme } from "./ThemeProvider";
import { themesById, type Theme } from "@/lib/themes";
import {
  CAMERA_PROFILES,
  PIN_SWITCH_DURATION_MS,
  RETURN_TO_FLAT,
} from "@/lib/map-cameras";
import PinMarker, { rotationFromId } from "./PinMarker";

// Layer ids that exist in mapbox/light-v11 and dark-v11 for road
// styling. Setting paint on a layer that doesn't exist is a no-op
// once we guard with getLayer() — listing common ones covers both.
const ROAD_LAYER_IDS = [
  "road-trunk",
  "road-primary",
  "road-secondary-tertiary",
  "road-street",
  "road-street-low",
  "road-minor",
  "road-major-link",
  "road-minor-link",
  "road-trunk-link",
  "road-primary-link",
  "road-secondary-link",
];


const FALLBACK_VIEW = { latitude: 20, longitude: 0, zoom: 1.5 };

export type LatLng = { lat: number; lng: number };

export interface MapHandle {
  flyTo: (latlng: LatLng, zoom?: number) => void;
}

interface Props {
  onMarkerClick?: (pinId: string) => void;
  onMapClick?: (latlng: LatLng) => void;
  pendingLatLng?: LatLng | null;
  recentlyAddedId?: string | null;
  previewLatLng?: LatLng | null;
  selectedLatLng?: LatLng | null;
  // Desktop opens with a wider FOV than mobile (smaller zoom number),
  // so the globe doesn't appear like a marble in a wide pane. Mobile
  // omits this prop and computeCenter's defaults apply.
  initialZoom?: number;
  // Set when ANY drawer is open. Locks pan/scroll/zoom so a tap on
  // the map area registers on the Drawer.Overlay above (which closes
  // the drawer) instead of dragging the map.
  mapLocked?: boolean;
}

// ============================================================
// Helpers
// ============================================================

function applyPaintOverrides(map: mapboxgl.Map, theme: Theme) {
  const { mapPaint } = theme;

  if (mapPaint.water != null && map.getLayer("water")) {
    map.setPaintProperty("water", "fill-color", mapPaint.water);
    if (mapPaint.waterOpacity != null) {
      map.setPaintProperty("water", "fill-opacity", mapPaint.waterOpacity);
    }
  }
  if (mapPaint.land != null) {
    for (const layer of ["land", "background"]) {
      const def = map.getLayer(layer);
      if (!def) continue;
      const prop =
        def.type === "background" ? "background-color" : "fill-color";
      map.setPaintProperty(layer, prop, mapPaint.land);
    }
  }

  if (mapPaint.roads) {
    const { color, opacity, lineWidthScale } = mapPaint.roads;
    for (const layer of ROAD_LAYER_IDS) {
      if (!map.getLayer(layer)) continue;
      map.setPaintProperty(layer, "line-color", color);
      map.setPaintProperty(layer, "line-opacity", opacity);
      if (lineWidthScale != null) {
        // Read current width and multiply. Mapbox returns the underlying
        // expression (or constant); wrapping with ['*', expr, scale]
        // keeps zoom-based scaling intact.
        const current = map.getPaintProperty(layer, "line-width");
        if (current != null) {
          map.setPaintProperty(layer, "line-width", [
            "*",
            current,
            lineWidthScale,
          ] as unknown as mapboxgl.Expression);
        }
      }
    }
  }

  if (mapPaint.hideLayers) {
    for (const layerId of mapPaint.hideLayers) {
      if (!map.getLayer(layerId)) continue;
      map.setLayoutProperty(layerId, "visibility", "none");
    }
  }

  if (mapPaint.recolorLabels) {
    for (const rule of mapPaint.recolorLabels) {
      if (!map.getLayer(rule.layerId)) continue;
      map.setPaintProperty(rule.layerId, "text-color", rule.textColor);
      if (rule.textHaloColor != null) {
        map.setPaintProperty(
          rule.layerId,
          "text-halo-color",
          rule.textHaloColor,
        );
      }
      if (rule.textHaloWidth != null) {
        map.setPaintProperty(
          rule.layerId,
          "text-halo-width",
          rule.textHaloWidth,
        );
      }
      if (rule.opacity != null) {
        map.setPaintProperty(rule.layerId, "text-opacity", rule.opacity);
      }
    }
  }
}

const BUILDINGS_LAYER_ID = "jf-3d-buildings";

function add3DBuildings(map: mapboxgl.Map, theme: Theme) {
  const buildings = theme.mapPaint.buildings;
  if (!buildings) {
    if (map.getLayer(BUILDINGS_LAYER_ID)) {
      map.removeLayer(BUILDINGS_LAYER_ID);
    }
    return;
  }

  // composite source / building layer aren't always present (custom styles).
  if (!map.getSource("composite")) return;

  if (map.getLayer(BUILDINGS_LAYER_ID)) {
    map.removeLayer(BUILDINGS_LAYER_ID);
  }

  map.addLayer({
    id: BUILDINGS_LAYER_ID,
    source: "composite",
    "source-layer": "building",
    filter: ["==", "extrude", "true"],
    type: "fill-extrusion",
    minzoom: 14,
    paint: {
      "fill-extrusion-color": buildings.color,
      "fill-extrusion-height": [
        "interpolate",
        ["linear"],
        ["zoom"],
        14,
        0,
        15.5,
        ["get", "height"],
      ],
      "fill-extrusion-base": ["get", "min_height"],
      "fill-extrusion-opacity": buildings.opacity,
    },
  });
}

function addTerrain(map: mapboxgl.Map) {
  if (!map.getSource("mapbox-dem")) {
    map.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom: 14,
    });
  }
  map.setTerrain({ source: "mapbox-dem", exaggeration: 1.2 });
}

// Terrain is invisible from orbit but still costs DEM tile downloads and a
// per-frame elevation pass. Only turn it on once the camera is close
// enough for relief to actually show; the zoomend listener below keeps it
// in sync as the user moves. Below the threshold the source stays idle.
const TERRAIN_MIN_ZOOM = 8;

function syncTerrain(map: mapboxgl.Map, suppressed: boolean) {
  const wantTerrain = !suppressed && map.getZoom() >= TERRAIN_MIN_ZOOM;
  const hasTerrain = map.getTerrain() != null;
  if (wantTerrain && !hasTerrain) addTerrain(map);
  else if (!wantTerrain && hasTerrain) map.setTerrain(null);
}

// Style-dependent layers only. Terrain is owned by the component so it can
// honour zoom level and pin-focus suppression.
function applyEnhancements(map: mapboxgl.Map, theme: Theme) {
  applyPaintOverrides(map, theme);
  add3DBuildings(map, theme);
}

function reducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function pinFillForTheme(
  pin: Pin,
  profilesByUser: Record<string, Profile>,
  theme: Theme,
): string {
  // theme.pinFill.visited wins for any visited pin.
  if (pin.has_visits) return theme.pinFill.visited;
  // theme.pinFill.override (Paper only) skips creator distinction
  // entirely — every unvisited pin uses the same color.
  if (theme.pinFill.override) return theme.pinFill.override;
  // Default behavior: per-creator hue.
  if (!pin.created_by) return "var(--accent)";
  const profile = profilesByUser[pin.created_by];
  if (!profile) return "var(--accent)";
  if (profile.display_name === "Jade") return "var(--pin-jade)";
  if (profile.display_name === "Frances") return "var(--pin-frances)";
  // Unknown names (e.g. the anonymized demo snapshot): assign the two
  // hues by profile order so the per-creator distinction survives.
  const ordered = Object.values(profilesByUser).sort((a, b) =>
    (a.created_at ?? a.user_id).localeCompare(b.created_at ?? b.user_id),
  );
  const index = ordered.findIndex((p) => p.user_id === profile.user_id);
  if (index === 0) return "var(--pin-jade)";
  if (index === 1) return "var(--pin-frances)";
  return "var(--accent)";
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

// ============================================================
// Component
// ============================================================

const Map = forwardRef<MapHandle, Props>(function Map(
  {
    onMarkerClick,
    onMapClick,
    pendingLatLng,
    recentlyAddedId,
    previewLatLng,
    selectedLatLng,
    initialZoom,
    mapLocked = false,
  },
  ref,
) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const { data: pins, isLoading, error } = usePins();
  const { data: profiles } = useProfiles();
  const { resolvedTheme } = useTheme();

  const profilesByUser = useMemo(() => {
    const m: Record<string, Profile> = {};
    (profiles ?? []).forEach((p) => {
      m[p.user_id] = p;
    });
    return m;
  }, [profiles]);

  const mapRef = useRef<MapRef | null>(null);
  // Set the moment a pin is opened, cleared after returning to flat.
  // Non-null === we're currently in 3D mode for some pin.
  const savedCameraRef = useRef<{
    center: [number, number];
    zoom: number;
    pitch: number;
    bearing: number;
  } | null>(null);
  const prevSelectedRef = useRef<LatLng | null>(null);
  // True while a pin is focused in a theme that wants flat ground
  // (satellite/Galaxy). Read by syncTerrain via the zoomend listener.
  const terrainSuppressedRef = useRef(false);
  // Set on the first user-driven camera move. Once the user has taken the
  // wheel we never auto-recentre on them.
  const userMovedRef = useRef(false);
  const centeredOnPinsRef = useRef(false);

  const mapStyle = themesById[resolvedTheme].mapStyle;

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (latlng, zoom = 16) => {
        const map = mapRef.current?.getMap();
        if (!map) return;
        if (reducedMotion()) {
          map.jumpTo({ center: [latlng.lng, latlng.lat], zoom });
          return;
        }
        map.flyTo({
          center: [latlng.lng, latlng.lat],
          zoom,
          duration: 1200,
          essential: true,
        });
      },
    }),
    [],
  );

  // The map mounts immediately with the fallback view so Mapbox can start
  // downloading its style and tiles in parallel with the pins query
  // instead of after it. When pins first arrive we glide to their centre,
  // unless the user has already started exploring.
  const initialViewState = useMemo(() => {
    const c = computeCenter(pins ?? []);
    return initialZoom != null ? { ...c, zoom: initialZoom } : c;
    // Only the first value is used (initialViewState is read at mount).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (centeredOnPinsRef.current) return;
    if (!pins || pins.length === 0) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    centeredOnPinsRef.current = true;
    if (userMovedRef.current) return;
    const c = computeCenter(pins);
    const target = {
      center: [c.longitude, c.latitude] as [number, number],
      zoom: initialZoom ?? c.zoom,
    };
    if (reducedMotion()) map.jumpTo(target);
    else map.easeTo({ ...target, duration: 900, essential: true });
  }, [pins, initialZoom]);

  // ----------------------------------------------------------
  // Re-apply enhancements when the theme switches the style URL.
  // ----------------------------------------------------------

  // react-map-gl swaps the style itself when the `mapStyle` prop changes
  // (one network fetch, one reload). A `style.load` listener registered
  // once in onLoad re-applies the buildings layer, paint overrides and
  // terrain afterwards; it reads the theme through a ref so the listener
  // never goes stale.
  const themeRef = useRef(resolvedTheme);
  useEffect(() => {
    themeRef.current = resolvedTheme;
  }, [resolvedTheme]);

  // ----------------------------------------------------------
  // Cinematic camera on pin open / close
  // ----------------------------------------------------------

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const wasSelected = prevSelectedRef.current != null;
    const isSelected = selectedLatLng != null;

    if (isSelected) {
      const profile = CAMERA_PROFILES[resolvedTheme];

      // First open: snapshot the current 2D camera so we can return to it.
      // Pin-switch (savedCameraRef already has a value) keeps the original
      // snapshot intact — we want to fall back to the *original* 2D view,
      // not the previous pin's 3D angle.
      if (!savedCameraRef.current) {
        const c = map.getCenter();
        savedCameraRef.current = {
          center: [c.lng, c.lat],
          zoom: map.getZoom(),
          pitch: map.getPitch(),
          bearing: map.getBearing(),
        };
      }

      // Satellite themes (Galaxy): drop terrain BEFORE the fly-to so
      // the surface goes flat instantly, before the camera moves. If
      // we did this after, the user would see a crumpled topo morph
      // into flat ground mid-flight, which is jarring.
      if (profile.disableTerrain) {
        terrainSuppressedRef.current = true;
        map.setTerrain(null);
      }

      const isPinSwitch = wasSelected;
      const duration = isPinSwitch
        ? PIN_SWITCH_DURATION_MS
        : profile.duration;

      // On mobile, push the camera target down so the pin sits above the
      // drawer rather than under it. Mapbox's `padding` shifts the
      // effective center on the projected viewport.
      const isMobile =
        typeof window !== "undefined" && window.innerWidth < 768;
      const drawerHeight = window.innerHeight * 0.6;
      const padding = isMobile
        ? { top: 0, right: 0, bottom: drawerHeight * 0.4, left: 0 }
        : undefined;

      const target = {
        center: [selectedLatLng.lng, selectedLatLng.lat] as [number, number],
        zoom: profile.zoom,
        pitch: profile.pitch,
        bearing: profile.bearing,
        padding,
      };

      if (reducedMotion()) {
        map.jumpTo(target);
      } else {
        map.flyTo({
          ...target,
          duration,
          curve: profile.curve,
          speed: profile.speed,
          essential: true,
        });
      }

      // Pan/scroll locking is owned by the lock effect below — we
      // only need to ensure rotate stays available so the user can
      // still look around the pin in 3D mode.
      map.dragRotate.enable();

      document.documentElement.dataset.mapMode = "3d";
    } else if (wasSelected) {
      // Drawer closed — fly back to the saved 2D state.
      const cam = savedCameraRef.current;
      if (cam) {
        const params = {
          center: cam.center,
          zoom: cam.zoom,
          pitch: 0,
          bearing: 0,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
        };

        if (reducedMotion()) {
          map.jumpTo(params);
        } else {
          map.flyTo({
            ...params,
            duration: RETURN_TO_FLAT.duration,
            curve: RETURN_TO_FLAT.curve,
            speed: RETURN_TO_FLAT.speed,
            essential: true,
          });
        }

        savedCameraRef.current = null;
      }

      // Lift the pin-focus suppression. The zoomend listener re-evaluates
      // terrain once the return flight lands (it'll stay off from orbit).
      terrainSuppressedRef.current = false;

      delete document.documentElement.dataset.mapMode;
    }

    prevSelectedRef.current = selectedLatLng ?? null;
  }, [selectedLatLng, resolvedTheme]);

  // ----------------------------------------------------------
  // Map gesture lock — driven by either pin focus or any-drawer-open.
  // Single source of truth so the two states can't fight each other.
  // ----------------------------------------------------------

  const shouldLock = selectedLatLng != null || mapLocked;
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (shouldLock) {
      map.dragPan.disable();
      map.scrollZoom.disable();
      map.boxZoom.disable();
      map.doubleClickZoom.disable();
    } else {
      map.dragPan.enable();
      map.scrollZoom.enable();
      map.boxZoom.enable();
      map.doubleClickZoom.enable();
    }
  }, [shouldLock]);

  // ----------------------------------------------------------
  // Performance: cap pitch on high-DPI devices, log slow first loads.
  // ----------------------------------------------------------

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (window.devicePixelRatio > 2.5) {
      map.setMaxPitch(60);
    }
    const start = performance.now();
    const onIdle = () => {
      const elapsed = performance.now() - start;
      if (elapsed > 2000) {
        console.warn(
          `[Map] First-idle took ${Math.round(elapsed)}ms — 3D may stutter on this device.`,
        );
      }
      map.off("idle", onIdle);
    };
    map.once("idle", onIdle);
  }, []);

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  if (!token) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-ink-soft">
        Missing NEXT_PUBLIC_MAPBOX_TOKEN
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-accent">
        Failed to load pins: {error.message}
      </div>
    );
  }

  const hasAnyPin = (pins ?? []).some(
    (p) => p.lat != null && p.lng != null,
  );

  return (
    <div className="relative h-full w-full">
      <MapboxMap
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={initialViewState}
        mapStyle={mapStyle}
        style={{ width: "100%", height: "100%" }}
        maxPitch={85}
        // Full reload on theme change rather than a diff: our custom
        // buildings layer / terrain would be diffed away anyway, and a
        // full load reliably fires `style.load` so we can re-apply them.
        styleDiffing={false}
        onLoad={(e) => {
          const map = e.target;
          applyEnhancements(map, themesById[themeRef.current]);
          syncTerrain(map, terrainSuppressedRef.current);
          map.on("style.load", () => {
            applyEnhancements(map, themesById[themeRef.current]);
            syncTerrain(map, terrainSuppressedRef.current);
          });
          map.on("zoomend", () =>
            syncTerrain(map, terrainSuppressedRef.current),
          );
          // originalEvent is only present for user gestures, not for
          // our own flyTo/easeTo calls.
          map.on("movestart", (ev) => {
            if (ev.originalEvent) userMovedRef.current = true;
          });
        }}
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
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onMarkerClick?.(pin.id);
              }}
            >
              <PinMarker
                fill={pinFillForTheme(
                  pin,
                  profilesByUser,
                  themesById[resolvedTheme],
                )}
                rotation={rotationFromId(pin.id)}
                animate={pin.id === recentlyAddedId}
                visitDayCount={pin.visit_day_count}
              />
            </Marker>
          ) : null,
        )}

        {pendingLatLng && (
          <Marker
            latitude={pendingLatLng.lat}
            longitude={pendingLatLng.lng}
            anchor="bottom"
          >
            <div style={{ opacity: 0.55 }}>
              <PinMarker fill="var(--accent)" rotation={0} />
            </div>
          </Marker>
        )}

        {previewLatLng && (
          <Marker
            latitude={previewLatLng.lat}
            longitude={previewLatLng.lng}
            anchor="bottom"
          >
            <div className="pin-pulse">
              <PinMarker fill="var(--accent)" rotation={0} size={36} />
            </div>
          </Marker>
        )}
      </MapboxMap>

      {!hasAnyPin && !isLoading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8">
          <p className="font-display italic text-2xl text-ink-soft text-center max-w-xs leading-snug">
            A blank world. Drop your first dream.
          </p>
        </div>
      )}
    </div>
  );
});

export default Map;
