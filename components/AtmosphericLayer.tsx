"use client";

import { useTheme } from "./ThemeProvider";

const FIXED_OVERLAY: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  zIndex: 5,
};

export default function AtmosphericLayer() {
  const { resolvedTheme } = useTheme();

  if (resolvedTheme === "galaxy") {
    return (
      <div
        aria-hidden="true"
        style={{
          ...FIXED_OVERLAY,
          background:
            // Bottom: cool atmospheric glow at planet's edge.
            // Top:    faint warm glow of galactic plane / distant suns.
            // Center: subtle radial dim (CSS-overlay terminator
            // approximation, multiply blend on the bg).
            `radial-gradient(ellipse 80% 40% at 50% 100%, rgba(91, 192, 232, 0.18) 0%, transparent 60%),
             radial-gradient(ellipse 60% 30% at 50% 0%, rgba(255, 157, 92, 0.08) 0%, transparent 70%)`,
        }}
      />
    );
  }

  if (resolvedTheme === "paper") {
    return (
      <div
        aria-hidden="true"
        style={{
          ...FIXED_OVERLAY,
          // Stronger vignette than the original spec (0.25 vs 0.12,
          // inner edge at 65% vs 50%) so it reads above the map.
          background:
            "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 65%, rgba(107, 93, 67, 0.25) 100%)",
        }}
      />
    );
  }

  return null;
}
