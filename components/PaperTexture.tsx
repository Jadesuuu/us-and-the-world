"use client";

import { useTheme } from "./ThemeProvider";

const FIXED_LAYER_STYLE: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  width: "100vw",
  height: "100vh",
  pointerEvents: "none",
  zIndex: 5, // above Mapbox canvas, below UI chrome
};

export default function PaperTexture() {
  const { resolvedTheme } = useTheme();
  if (resolvedTheme !== "paper") return null;

  return (
    <>
      {/* Grain. Doubled from 0.06 to 0.12 since this now renders ABOVE
          the map — needs roughly 2× the opacity to read the same. */}
      <svg
        aria-hidden="true"
        style={{ ...FIXED_LAYER_STYLE, opacity: 0.12 }}
      >
        <defs>
          <filter id="paper-grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves={2}
              stitchTiles="stitch"
              seed={7}
            />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#paper-grain)" />
      </svg>

      {/* Ruled lines, also bumped: 0.04 → 0.08. */}
      <svg
        aria-hidden="true"
        style={{ ...FIXED_LAYER_STYLE, opacity: 0.08 }}
      >
        <defs>
          <pattern
            id="paper-rules"
            patternUnits="userSpaceOnUse"
            width="100"
            height="24"
          >
            <line
              x1="0"
              y1="23.5"
              x2="100"
              y2="23.5"
              stroke="#2B2317"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#paper-rules)" />
      </svg>
    </>
  );
}
