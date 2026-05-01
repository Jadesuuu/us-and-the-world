import type { ThemeId } from "./themes";

export interface CameraProfile {
  pitch: number;
  bearing: number;
  zoom: number;
  duration: number;
  curve: number;
  speed: number;
  // True for themes whose map style is satellite imagery: terrain
  // exaggeration distorts photos at street zoom and is dropped before
  // the fly-to so the user never sees it pop flat mid-flight.
  disableTerrain?: boolean;
}

export const CAMERA_PROFILES: Record<ThemeId, CameraProfile> = {
  // Calm arrival, slight cinematic tilt.
  dream: {
    pitch: 55,
    bearing: 25,
    zoom: 17,
    duration: 2200,
    curve: 1.4,
    speed: 0.8,
  },
  // A touch more pitch and bearing, slightly slower.
  night: {
    pitch: 60,
    bearing: 35,
    zoom: 17.2,
    duration: 2400,
    curve: 1.5,
    speed: 0.75,
  },
  // Satellite imagery + 3D terrain looks crumpled at street zoom.
  // Lower pitch + flat surface keeps the "from orbit" feeling intact
  // without the topo distortion.
  galaxy: {
    pitch: 50,
    bearing: 30,
    zoom: 17,
    duration: 2400,
    curve: 1.5,
    speed: 0.7,
    disableTerrain: true,
  },
  // Flatter, topographic-map feel.
  paper: {
    pitch: 40,
    bearing: 15,
    zoom: 16.8,
    duration: 1800,
    curve: 1.2,
    speed: 0.9,
  },
};

// Applied for ALL themes when the drawer closes.
export const RETURN_TO_FLAT = {
  pitch: 0,
  bearing: 0,
  duration: 1400,
  curve: 1.2,
  speed: 1.1,
};

// When switching from one open pin directly to another, use a faster
// duration since we're already in 3D mode.
export const PIN_SWITCH_DURATION_MS = 1400;
