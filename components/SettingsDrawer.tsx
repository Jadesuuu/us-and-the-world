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
      className="flex flex-col gap-2 rounded-2xl p-[14px] text-left"
      style={{
        backgroundColor: theme.vars.bg,
        border: isActive
          ? `2px solid ${theme.vars.accent}`
          : `0.5px solid ${theme.vars.border}`,
      }}
    >
      <div
        className="font-display italic text-[18px] leading-none"
        style={{ color: theme.vars.ink }}
      >
        {theme.name}
      </div>
      <div className="flex gap-1">
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
        style={{ color: theme.vars["ink-soft"] }}
      >
        {theme.description}
      </div>
    </button>
  );
}
