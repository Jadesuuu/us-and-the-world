"use client";

import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import { themes, type Theme } from "@/lib/themes";
import { useTheme } from "./ThemeProvider";
import { Toggle } from "./ui/Toggle";
import {
  checkPushSupport,
  getCurrentSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";
import { toast } from "sonner";

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
      modal
      dismissible
    >
      <Drawer.Portal>
        <Drawer.Overlay
          className="fixed inset-0 z-30"
          style={{ backgroundColor: "color-mix(in srgb, var(--ink) 25%, transparent)" }}
        />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col rounded-t-3xl bg-bg outline-none border-t border-border">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-ink/20" />
          <div className="overflow-y-auto px-6 pb-8 pt-4">
            <Drawer.Title className="font-display italic text-[22px] font-medium text-ink">
              Settings
            </Drawer.Title>

            <section className="mt-6">
              <h3 className="font-display italic text-[14px] text-ink-soft">
                Notifications
              </h3>
              <div className="mt-3">
                <NotificationToggle />
              </div>
            </section>

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

// Drawer-free version of the same content — used by the desktop popover
// in DesktopHeader. The popover provides its own outer chrome (no title
// element, no scroll container).
export function SettingsContent() {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display italic text-[20px] font-medium text-ink">
        Settings
      </h2>
      <section className="mt-1">
        <h3 className="font-display italic text-[13px] text-ink-soft">
          Notifications
        </h3>
        <div className="mt-2">
          <NotificationToggle />
        </div>
      </section>
      <section className="mt-3">
        <h3 className="font-display italic text-[13px] text-ink-soft">Mood</h3>
        <div className="mt-2">
          <ThemePicker />
        </div>
      </section>
    </div>
  );
}

// Push-notifications opt-in. Reflects the live state of the browser's
// PushManager subscription so the toggle is honest across reloads,
// other devices, and OS-level permission revocation.
function NotificationToggle() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const support = checkPushSupport();
      if (!support.supported) {
        if (!alive) return;
        if (support.reason === "ios-needs-pwa-install") {
          setHint(
            "On iPhone: tap Share → Add to Home Screen, then come back here.",
          );
        } else {
          setHint("This browser doesn't support push notifications.");
        }
        return;
      }
      const sub = await getCurrentSubscription();
      if (alive) setEnabled(sub != null);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function onChange(next: boolean) {
    setBusy(true);
    try {
      if (next) {
        const ok = await subscribeToPush();
        if (ok) {
          setEnabled(true);
          toast("Notifications on — you'll know when a new dream lands.");
        } else {
          setEnabled(false);
          toast.error("Permission denied. You can re-enable in browser settings.");
        }
      } else {
        await unsubscribeFromPush();
        setEnabled(false);
        toast("Notifications off.");
      }
    } catch (err) {
      setEnabled(false);
      toast.error(
        err instanceof Error ? err.message : "Couldn't update notifications.",
      );
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || hint != null;

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex items-center justify-between rounded-xl bg-surface px-4 py-3"
        style={{ border: "1px solid var(--border)" }}
      >
        <div className="flex flex-col">
          <span className="font-display italic text-[15px] text-ink">
            New pin from your partner
          </span>
          <span className="text-[12px] text-ink-soft">
            Get notified when a new place is dreamed of
          </span>
        </div>
        <Toggle
          checked={enabled}
          onChange={onChange}
          disabled={disabled}
          label="Notify on new partner pins"
        />
      </div>
      {hint && (
        <p className="px-1 font-body italic text-[12px] text-ink-soft">
          {hint}
        </p>
      )}
    </div>
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

// Tile preview: the same starfield image used in the live theme,
// cover-fit to the tile, with a soft dark overlay so the title and
// swatches stay legible against the brighter star clusters.
function GalaxyTileFlourish() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{
        zIndex: 0,
        backgroundImage:
          // Vignette overlay first (paints on top), then the photo.
          "linear-gradient(180deg, rgba(5,11,31,0.55) 0%, rgba(5,11,31,0.15) 35%, rgba(5,11,31,0.65) 100%), " +
          "url(/textures/starfield.webp)",
        backgroundSize: "cover, cover",
        backgroundPosition: "center, center",
      }}
    />
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
