"use client";

export type Tab = "map" | "add" | "memories";

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  hidden?: boolean;
}

export default function BottomNav({ active, onChange, hidden = false }: Props) {
  return (
    <nav
      aria-hidden={hidden}
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(env(safe-area-inset-bottom),0.5rem)] transition-transform duration-200 ease-out ${
        hidden ? "translate-y-full" : "translate-y-0"
      }`}
    >
      <div
        className="pointer-events-auto flex items-center gap-1 rounded-full bg-surface p-1 shadow-md"
        style={{ border: "1px solid var(--border)" }}
      >
        <TabButton
          label="Dreaming"
          isActive={active === "map"}
          onClick={() => onChange("map")}
        />
        <button
          type="button"
          aria-label="Drop a dream"
          onClick={() => onChange("add")}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-2xl font-light text-bg"
        >
          +
        </button>
        <TabButton
          label="Lived"
          isActive={active === "memories"}
          onClick={() => onChange("memories")}
        />
      </div>
    </nav>
  );
}

function TabButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 h-10 rounded-full font-display text-base ${
        isActive ? "italic text-ink" : "text-ink-soft"
      }`}
    >
      {label}
    </button>
  );
}
