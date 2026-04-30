"use client";

export type Tab = "map" | "add" | "memories";

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export default function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(env(safe-area-inset-bottom),0.5rem)]">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950/90 p-1 shadow-lg backdrop-blur">
        <TabButton
          label="Map"
          isActive={active === "map"}
          onClick={() => onChange("map")}
        />
        <button
          type="button"
          aria-label="Add pin"
          onClick={() => onChange("add")}
          className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl font-light transition-colors ${
            active === "add"
              ? "bg-white text-zinc-950"
              : "bg-zinc-100 text-zinc-950 hover:bg-white"
          }`}
        >
          +
        </button>
        <TabButton
          label="Memories"
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
      className={`px-4 h-10 rounded-full text-sm font-medium transition-colors ${
        isActive ? "text-white" : "text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}
