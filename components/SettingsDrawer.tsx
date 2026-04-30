"use client";

import { Drawer } from "vaul";
import { themes, type Theme } from "@/lib/themes";
import { useTheme } from "./ThemeProvider";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDrawer({ open, onClose }: Props) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      modal={false}
    >
      <Drawer.Portal>
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-3xl bg-bg outline-none border-t border-border">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-ink/20" />
          <div className="overflow-y-auto px-6 pb-8 pt-4">
            <Drawer.Title className="font-display italic text-[22px] font-medium text-ink">
              Settings
            </Drawer.Title>

            <section className="mt-6">
              <h3 className="font-display italic text-[14px] text-ink-soft">
                Mood
              </h3>
              <div className="mt-3">
                <ThemePicker />
              </div>
            </section>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function ThemePicker() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const isAuto = theme === "auto";

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setTheme("auto")}
        className="flex h-11 w-full items-center justify-center rounded-xl bg-surface font-display italic text-base text-ink"
        style={{
          border: isAuto
            ? "2px solid var(--accent)"
            : "1px solid var(--border)",
        }}
      >
        Auto
      </button>
      {isAuto && (
        <p className="-mt-2 text-center font-body italic text-[12px] text-ink-soft">
          currently showing {resolvedTheme}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 min-[380px]:grid-cols-2 max-[379px]:grid-cols-1">
        {themes.map((t) => (
          <ThemeTile
            key={t.id}
            theme={t}
            isActive={!isAuto && theme === t.id}
            onClick={() => setTheme(t.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ThemeTile({
  theme,
  isActive,
  onClick,
}: {
  theme: Theme;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={theme.personality}
      className="relative flex flex-col gap-2 overflow-hidden rounded-2xl p-[14px] text-left"
      style={{
        backgroundColor: theme.vars.bg,
        border: isActive
          ? `2px solid ${theme.vars.accent}`
          : `0.5px solid ${theme.vars.border}`,
      }}
    >
      {theme.id === "galaxy" && <GalaxyTileFlourish />}
      {theme.id === "paper" && <PaperTileFlourish />}

      <div
        className="font-display italic text-[18px] leading-none"
        style={{ color: theme.vars.ink, position: "relative", zIndex: 1 }}
      >
        {theme.name}
      </div>
      <div className="flex gap-1" style={{ position: "relative", zIndex: 1 }}>
        {theme.swatches.map((color, i) => (
          <span
            key={i}
            className="h-4 w-4 rounded-[3px]"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <div
        className="text-[12px] leading-tight"
        style={{ color: theme.vars["ink-soft"], position: "relative", zIndex: 1 }}
      >
        {theme.description}
      </div>
    </button>
  );
}

// Eight scattered white dots so the Galaxy tile reads as starfield at
// thumbnail size — not just "the dark blue tile".
const TILE_GALAXY_STARS = [
  { cx: 14, cy: 16, r: 0.9, o: 0.55 },
  { cx: 28, cy: 8, r: 0.6, o: 0.4 },
  { cx: 46, cy: 28, r: 1.0, o: 0.6 },
  { cx: 66, cy: 14, r: 0.7, o: 0.45 },
  { cx: 82, cy: 24, r: 1.3, o: 0.7 },
  { cx: 22, cy: 60, r: 0.6, o: 0.35 },
  { cx: 58, cy: 72, r: 0.9, o: 0.5 },
  { cx: 86, cy: 80, r: 0.7, o: 0.45 },
];
function GalaxyTileFlourish() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 0 }}
    >
      {TILE_GALAXY_STARS.map((s, i) => (
        <circle
          key={i}
          cx={s.cx}
          cy={s.cy}
          r={s.r}
          fill="#ffffff"
          opacity={s.o}
        />
      ))}
    </svg>
  );
}

// Paper tile: subtle grain across the whole tile + a small fleuron
// in the bottom-right. The grain is a tile-scoped feTurbulence so
// the picker reads as "textured paper" at glance.
function PaperTileFlourish() {
  return (
    <>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ zIndex: 0, opacity: 0.18 }}
      >
        <defs>
          <filter id="paper-tile-grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves={2}
              stitchTiles="stitch"
              seed={3}
            />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#paper-tile-grain)" />
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="pointer-events-none absolute"
        style={{
          bottom: 8,
          right: 8,
          width: 22,
          height: 22,
          color: "#4A5840",
          opacity: 0.55,
          zIndex: 0,
        }}
      >
        <path
          d="M12 4
             C 12 8, 16 8, 16 12
             C 16 16, 12 16, 12 20
             C 12 16, 8 16, 8 12
             C 8 8, 12 8, 12 4 Z"
          fill="currentColor"
        />
        <circle cx="12" cy="12" r="1.5" fill="#F2EBD8" />
      </svg>
    </>
  );
}
