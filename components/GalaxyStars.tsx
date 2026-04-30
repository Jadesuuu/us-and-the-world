"use client";

import { useTheme } from "./ThemeProvider";

// Mulberry32 PRNG — deterministic, seeded once at module load.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NEAR_STARS = (() => {
  const rng = mulberry32(0x4a464657); // "JFFW"
  return Array.from({ length: 80 }, () => ({
    cx: Number((rng() * 100).toFixed(2)),
    cy: Number((rng() * 100).toFixed(2)),
    r: Number((0.8 + rng() * 0.7).toFixed(2)),
  }));
})();

// Sparser, larger. Used only for Galaxy + 3D mode for parallax depth.
const DEEP_STARS = (() => {
  const rng = mulberry32(0x44535453); // "DSTS"
  return Array.from({ length: 20 }, () => ({
    cx: Number((rng() * 100).toFixed(2)),
    cy: Number((rng() * 100).toFixed(2)),
    r: Number((1.5 + rng() * 1.5).toFixed(2)),
  }));
})();

const FIXED_LAYER_STYLE: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  width: "100vw",
  height: "100vh",
  pointerEvents: "none",
  zIndex: -1,
};

export default function GalaxyStars() {
  const { resolvedTheme } = useTheme();
  if (resolvedTheme !== "galaxy" && resolvedTheme !== "night") return null;

  // Slightly subtler in Night so they read as "a clear sky" not "deep space".
  const nearOpacity = resolvedTheme === "galaxy" ? 0.06 : 0.05;
  const isGalaxy = resolvedTheme === "galaxy";

  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        style={FIXED_LAYER_STYLE}
      >
        {NEAR_STARS.map((s, i) => (
          <circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill="#ffffff"
            opacity={nearOpacity}
          />
        ))}
      </svg>

      {isGalaxy && (
        // Deep parallax layer. Visibility and rotation are controlled
        // by CSS based on the document's data-map-mode attribute and
        // the --bearing custom property, both set by Map.tsx.
        <svg
          aria-hidden="true"
          className="galaxy-stars-deep"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
          style={FIXED_LAYER_STYLE}
        >
          {DEEP_STARS.map((s, i) => (
            <circle
              key={i}
              cx={s.cx}
              cy={s.cy}
              r={s.r}
              fill="#ffffff"
              opacity={0.08}
            />
          ))}
        </svg>
      )}
    </>
  );
}
