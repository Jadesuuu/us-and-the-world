"use client";

import { useRef, useState } from "react";
import SearchControl, { type ResolvedPlace } from "@/components/SearchControl";
import { SettingsContent } from "@/components/SettingsDrawer";
import Popover from "./Popover";

interface Props {
  onPlacePick: (place: ResolvedPlace) => void;
}

export default function DesktopHeader({ onPlacePick }: Props) {
  const avatarRef = useRef<HTMLButtonElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <header
      className="flex h-[60px] shrink-0 items-center bg-bg px-6"
      style={{ borderBottom: "0.5px solid var(--border)" }}
    >
      <h1 className="font-display italic text-[22px] font-medium text-ink">
        JF &amp; The World
      </h1>

      <div className="flex flex-1 justify-center">
        <SearchControl
          variant="inline"
          onPick={onPlacePick}
        />
      </div>

      <button
        ref={avatarRef}
        type="button"
        aria-label="Settings"
        aria-haspopup="dialog"
        aria-expanded={settingsOpen}
        onClick={() => setSettingsOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink"
        style={{ border: "1px solid var(--border)" }}
      >
        <span aria-hidden className="text-lg leading-none tracking-widest">
          ···
        </span>
      </button>

      <Popover
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        anchorRef={avatarRef}
        align="end"
        width={360}
      >
        <SettingsContent />
      </Popover>
    </header>
  );
}
