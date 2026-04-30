export type ThemeId = "dream" | "night" | "galaxy" | "paper";
export type ThemePreference = ThemeId | "auto";

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  swatches: [string, string, string, string, string]; // bg, surface, pin-jade, pin-frances, accent
  mapStyle: string;
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

export const themes: Theme[] = [
  {
    id: "dream",
    name: "Dream",
    description: "cream, terracotta, sage",
    swatches: ["#F7F1E8", "#E8D9B8", "#4A7AB0", "#D88578", "#C8553D"],
    mapStyle: "mapbox://styles/mapbox/light-v11",
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
    swatches: ["#0F1729", "#1F2A44", "#7BA4D0", "#E89BAB", "#F4955C"],
    mapStyle: "mapbox://styles/mapbox/dark-v11",
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
    description: "cosmic indigo, deep ocean, lavender",
    swatches: ["#0E0B26", "#1E1A45", "#7BA8E0", "#C5A8FF", "#B89AFF"],
    mapStyle: "mapbox://styles/mapbox/dark-v11",
    vars: {
      bg: "#0E0B26",
      surface: "#1E1A45",
      ink: "#E8DDFF",
      "ink-soft": "#9D93C4",
      accent: "#B89AFF",
      "accent-2": "#3D5A80",
      "pin-jade": "#7BA8E0",
      "pin-frances": "#C5A8FF",
      border: "rgba(232, 221, 255, 0.10)",
    },
  },
  {
    id: "paper",
    name: "Paper",
    description: "bone white, walnut, forest",
    swatches: ["#FAF7F0", "#ECE5D5", "#3A5C7F", "#B07A65", "#8B5A3C"],
    mapStyle: "mapbox://styles/mapbox/light-v11",
    vars: {
      bg: "#FAF7F0",
      surface: "#ECE5D5",
      ink: "#2E2A24",
      "ink-soft": "#5C5448",
      accent: "#8B5A3C",
      "accent-2": "#4A6B5E",
      "pin-jade": "#3A5C7F",
      "pin-frances": "#B07A65",
      border: "rgba(46, 42, 36, 0.12)",
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
