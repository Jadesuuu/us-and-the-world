import type { ThemeId } from "./themes";

export interface CameraProfile {
  pitch: number;
  bearing: number;
  zoom: number;
  duration: number;
  curve: number;
  speed: number;
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
  // Most dramatic — descending from orbit.
  galaxy: {
    pitch: 70,
    bearing: 45,
    zoom: 17.5,
    duration: 3000,
    curve: 1.8,
    speed: 0.6,
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
