"use client";

import { useTheme } from "./ThemeProvider";

// Image: NASA NEOWISE final mission image (PIA26385) — wide infrared
// starfield in the constellation Fornax. Public domain (NASA imagery,
// non-trademarked). Source: images.nasa.gov/details/PIA26385.
//
// The webp is fixed at viewport edges and sits at z-index -1, BELOW the
// Mapbox canvas. Globe projection leaves the area outside Earth
// transparent — the starfield shows through there.
const STARFIELD_URL = "/textures/starfield.webp";

// Fallback if the webp 404s on a slow/blocked connection: a deep-space
// radial gradient with a few CSS pinpoint stars from a layered
// background-image. Not as nice as the photo, but never broken.
const FALLBACK_BG =
  "radial-gradient(ellipse at 50% 50%, #0a1530 0%, #050b1f 60%, #02050f 100%), " +
  // Three tiny white "stars" via background-image color-stops, tiled.
  "radial-gradient(1px 1px at 20% 30%, #ffffff 100%, transparent 100%), " +
  "radial-gradient(1px 1px at 70% 60%, #ffffff 100%, transparent 100%), " +
  "radial-gradient(1px 1px at 40% 80%, #ffffff 100%, transparent 100%)";

export default function GalaxyBackdrop() {
  const { resolvedTheme } = useTheme();
  if (resolvedTheme !== "galaxy") return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#02050f",
        backgroundImage: `url(${STARFIELD_URL}), ${FALLBACK_BG}`,
        backgroundSize: "cover, cover",
        backgroundPosition: "center, center",
        backgroundRepeat: "no-repeat, no-repeat",
        pointerEvents: "none",
        zIndex: -1,
      }}
    />
  );
}
