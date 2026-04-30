export type ThemeId = "dream" | "night" | "galaxy" | "paper";
export type ThemePreference = ThemeId | "auto";

export interface ThemeMapPaint {
  water: string;
  waterOpacity?: number; // applied as fill-opacity if set
  land: string;
  roads?: {
    color: string;
    opacity: number;
    lineWidthScale?: number; // multiplies the style's existing line-width
  };
  buildings?: { color: string; opacity: number };
  hideLayers?: string[]; // layer ids to set visibility: none
  recolorLabels?: Array<{
    layerId: string;
    textColor: string;
    opacity?: number;
  }>;
}

export interface ThemePinFill {
  visited: string;
  override?: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  personality: string;
  swatches: [string, string, string, string, string];
  mapStyle: string;
  mapPaint: ThemeMapPaint;
  pinFill: ThemePinFill;
  vars: {
    bg: string;
    surface: string;
    ink: string;
    "ink-soft": string;
    accent: string;
    "accent-2": string;
    "pin-jade": string;
    "pin-frances": string;
    border: string;
  };
}

// Common Mapbox label layer ids used across light-v11 / dark-v11. Some
// of these may not exist in every style version; setLayoutProperty
// guards on getLayer() so missing ids are safely ignored.
const ROAD_LABEL_LAYERS = [
  "road-label",
  "road-label-simple",
  "road-label-navigation",
  "road-number-shield",
  "road-exit-shield",
];
const POI_LABEL_LAYERS = [
  "poi-label",
  "natural-line-label",
  "natural-point-label",
  "water-line-label",
  "water-point-label",
];
const MINOR_PLACE_LABELS = [
  "settlement-minor-label",
  "settlement-subdivision-label",
];

export const themes: Theme[] = [
  {
    id: "dream",
    name: "Dream",
    description: "cream, terracotta, sage",
    personality: "Tuesday afternoon, golden light",
    swatches: ["#F7F1E8", "#E8D9B8", "#4A7AB0", "#D88578", "#C8553D"],
    mapStyle: "mapbox://styles/mapbox/light-v11",
    mapPaint: {
      water: "#5C7A6F",
      land: "#F7F1E8",
      buildings: { color: "#E8D9B8", opacity: 0.7 },
    },
    pinFill: { visited: "var(--ink)" },
    vars: {
      bg: "#F7F1E8",
      surface: "#E8D9B8",
      ink: "#3C2E1F",
      "ink-soft": "#6B5847",
      accent: "#C8553D",
      "accent-2": "#5C7A6F",
      "pin-jade": "#4A7AB0",
      "pin-frances": "#D88578",
      border: "rgba(60, 46, 31, 0.12)",
    },
  },
  {
    id: "night",
    name: "Night",
    description: "midnight blue, sunset peach",
    personality: "After dinner, before sleep",
    swatches: ["#0F1729", "#1F2A44", "#7BA4D0", "#E89BAB", "#F4955C"],
    mapStyle: "mapbox://styles/mapbox/dark-v11",
    mapPaint: {
      water: "#76B0A4",
      land: "#0F1729",
      buildings: { color: "#9BABCB", opacity: 0.35 },
    },
    pinFill: { visited: "var(--ink)" },
    vars: {
      bg: "#0F1729",
      surface: "#1F2A44",
      ink: "#E6ECF5",
      "ink-soft": "#9BABCB",
      accent: "#F4955C",
      "accent-2": "#76B0A4",
      "pin-jade": "#7BA4D0",
      "pin-frances": "#E89BAB",
      border: "rgba(230, 236, 245, 0.10)",
    },
  },
  {
    id: "galaxy",
    name: "Galaxy",
    description: "Earth at night. Quiet awe.",
    personality: "From orbit, looking down",
    swatches: ["#050B1F", "#0A1530", "#5BC0E8", "#FF9D5C", "#E8EEF7"],
    mapStyle: "mapbox://styles/mapbox/dark-v11",
    mapPaint: {
      water: "#050B1F",
      // Continents barely visible — nearly the same as bg so only
      // outlines hint at land. Tweaked from #0E1A38 → #0A1426.
      land: "#0A1426",
      roads: {
        color: "#FF9D5C",
        opacity: 0.3,
        lineWidthScale: 0.5, // halved — roads as faint sodium-light grid
      },
      buildings: { color: "#8FA0BC", opacity: 0.2 },
      hideLayers: [
        ...ROAD_LABEL_LAYERS,
        ...POI_LABEL_LAYERS,
        ...MINOR_PLACE_LABELS,
      ],
      recolorLabels: [
        { layerId: "country-label", textColor: "#E8EEF7", opacity: 0.3 },
        // Major cities: warm amber dots, the only "bright" labels left.
        { layerId: "settlement-major-label", textColor: "#FF9D5C", opacity: 0.55 },
      ],
    },
    pinFill: { visited: "var(--ink)" },
    vars: {
      bg: "#050B1F",
      surface: "#0A1530",
      ink: "#E8EEF7",
      "ink-soft": "#8FA0BC",
      accent: "#FF9D5C",
      "accent-2": "#5BC0E8",
      "pin-jade": "#5BC0E8",
      "pin-frances": "#FF9D5C",
      border: "rgba(232, 238, 247, 0.08)",
    },
  },
  {
    id: "paper",
    name: "Paper",
    description: "A field notebook. Inked and kept.",
    personality: "An archive of where we've been",
    swatches: ["#F2EBD8", "#E5DAB8", "#A83D2D", "#4A5840", "#2B2317"],
    mapStyle: "mapbox://styles/mapbox/light-v11",
    mapPaint: {
      water: "#B8C4A8",
      waterOpacity: 0.85, // hand-painted feel, lets grain peek through
      // Slightly darker than --bg (#F2EBD8) so water and land have
      // visible contrast on the map.
      land: "#ECE2C5",
      roads: {
        color: "#6B5D43",
        opacity: 0.5,
        lineWidthScale: 1.5, // thicker — old topo-map inked roads
      },
      buildings: { color: "#6B5D43", opacity: 0.4 },
      hideLayers: [...POI_LABEL_LAYERS, ...MINOR_PLACE_LABELS],
      recolorLabels: [
        { layerId: "country-label", textColor: "#2B2317", opacity: 0.6 },
        { layerId: "state-label", textColor: "#2B2317", opacity: 0.6 },
        { layerId: "settlement-major-label", textColor: "#2B2317", opacity: 0.7 },
      ],
    },
    pinFill: { visited: "var(--accent-2)", override: "var(--accent)" },
    vars: {
      bg: "#F2EBD8",
      surface: "#E5DAB8",
      ink: "#2B2317",
      "ink-soft": "#6B5D43",
      accent: "#A83D2D",
      "accent-2": "#4A5840",
      "pin-jade": "#A83D2D",
      "pin-frances": "#A83D2D",
      border: "rgba(43, 35, 23, 0.18)",
    },
  },
];

export const themesById: Record<ThemeId, Theme> = themes.reduce(
  (acc, t) => {
    acc[t.id] = t;
    return acc;
  },
  {} as Record<ThemeId, Theme>,
);

export function resolveTheme(
  preference: ThemePreference,
  systemDark: boolean,
): ThemeId {
  if (preference === "auto") return systemDark ? "night" : "dream";
  return preference;
}
