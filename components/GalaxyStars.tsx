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

interface StarSpec {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  opacity: number;
  bright: boolean;
}

// Galaxy: 120 stars across three brightness/size tiers. Opacities
// roughly doubled vs the original spec because these now render
// ABOVE the map, not behind it — the map's own contrast eats stars
// quickly otherwise.
const GALAXY_STARS: StarSpec[] = (() => {
  const rng = mulberry32(0x4a464657);
  const out: StarSpec[] = [];
  for (let i = 0; i < 120; i++) {
    const sizeRoll = rng();
    let r: number;
    let bright = false;
    if (sizeRoll < 0.7) {
      r = 0.6 + rng() * 0.4; // background dust
    } else if (sizeRoll < 0.95) {
      r = 1.0 + rng() * 0.8; // mid stars
    } else {
      r = 2.0 + rng() * 0.8; // foreground bright
      bright = true;
    }
    const warm = rng() < 0.1;
    // Calibrated for visibility above the map:
    //   background dust: 8–14%
    //   mid stars:       12–18%
    //   bright:          22–32%
    let opacity: number;
    if (sizeRoll < 0.7) {
      opacity = 0.08 + rng() * 0.06;
    } else if (sizeRoll < 0.95) {
      opacity = 0.12 + rng() * 0.06;
    } else {
      opacity = 0.22 + rng() * 0.1;
    }
    if (warm) opacity = Math.min(0.4, opacity + 0.04);
    out.push({
      cx: Number((rng() * 100).toFixed(2)),
      cy: Number((rng() * 100).toFixed(2)),
      r: Number(r.toFixed(2)),
      fill: warm ? "#FFCBA0" : "#FFFFFF",
      opacity: Number(opacity.toFixed(3)),
      bright,
    });
  }
  return out;
})();

const NIGHT_STARS = (() => {
  const rng = mulberry32(0x4a464657);
  return Array.from({ length: 80 }, () => ({
    cx: Number((rng() * 100).toFixed(2)),
    cy: Number((rng() * 100).toFixed(2)),
    r: Number((0.8 + rng() * 0.7).toFixed(2)),
  }));
})();

const DEEP_STARS = (() => {
  const rng = mulberry32(0x44535453);
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
  zIndex: 5, // above Mapbox canvas (0/1), below UI chrome (30+)
};

export default function GalaxyStars() {
  const { resolvedTheme } = useTheme();
  if (resolvedTheme !== "galaxy" && resolvedTheme !== "night") return null;

  if (resolvedTheme === "night") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        style={FIXED_LAYER_STYLE}
      >
        {NIGHT_STARS.map((s, i) => (
          <circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill="#ffffff"
            // Bumped from 0.05 to 0.10 since this layer is now above
            // the dark-v11 map instead of behind it.
            opacity={0.1}
          />
        ))}
      </svg>
    );
  }

  // Galaxy. The fadein class runs once on mount; if the user toggles
  // away and back, it replays — acceptable since theme switching is
  // a deliberate gesture and the animation is gentle.
  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="galaxy-stars-fadein"
        style={FIXED_LAYER_STYLE}
      >
        {GALAXY_STARS.map((s, i) => (
          <circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill={s.fill}
            opacity={s.opacity}
            // Bumped drop-shadow blur from 2 → 3 so foreground stars
            // glow more legibly above the map.
            style={
              s.bright
                ? {
                    filter: `drop-shadow(0 0 3px ${s.fill})`,
                  }
                : undefined
            }
          />
        ))}
      </svg>

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
            opacity={0.12}
          />
        ))}
      </svg>
    </>
  );
}
