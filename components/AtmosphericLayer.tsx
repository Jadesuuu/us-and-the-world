"use client";

import { useTheme } from "./ThemeProvider";

export default function AtmosphericLayer() {
  const { resolvedTheme } = useTheme();

  if (resolvedTheme === "galaxy") {
    // Sits BELOW the map (zIndex 0) so the glow only shows in the
    // transparent area around the globe — a soft cyan rim at the
    // bottom, framing Earth from outside. The amber top glow that
    // used to live here was retired with the warm-amber accent.
    return (
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          background:
            "radial-gradient(ellipse 80% 40% at 50% 100%, rgba(91, 192, 232, 0.18) 0%, transparent 60%)",
        }}
      />
    );
  }

  if (resolvedTheme === "paper") {
    // Vignette must paint OVER paper's opaque light-v11 map, so this
    // one stays at zIndex 5.
    return (
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 5,
          background:
            "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 65%, rgba(107, 93, 67, 0.25) 100%)",
        }}
      />
    );
  }

  return null;
}
