"use client";

import { useMemo, useState } from "react";
import Map, { type LatLng } from "@/components/Map";
import PinDrawer from "@/components/PinDrawer";
import AddPinDrawer from "@/components/AddPinDrawer";
import BottomNav, { type Tab } from "@/components/BottomNav";
import { usePins, type Pin } from "@/hooks/usePins";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("map");
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [pendingLatLng, setPendingLatLng] = useState<LatLng | null>(null);

  const { data: pins } = usePins();
  const selectedPin = pins?.find((p) => p.id === selectedPinId) ?? null;

  const isAddOpen = activeTab === "add";
  const isMemories = activeTab === "memories";

  return (
    <main className="relative flex flex-1">
      <Map
        onMarkerClick={(id) => {
          setActiveTab("map");
          setPendingLatLng(null);
          setSelectedPinId(id);
        }}
        onMapClick={(latlng) => {
          if (isAddOpen) {
            setPendingLatLng(latlng);
          } else if (selectedPinId) {
            setSelectedPinId(null);
          }
        }}
        pendingLatLng={isAddOpen ? pendingLatLng : null}
      />

      <PinDrawer
        pin={isAddOpen ? null : selectedPin}
        onClose={() => setSelectedPinId(null)}
        readOnly={isMemories}
      />

      <AddPinDrawer
        open={isAddOpen}
        pendingLatLng={pendingLatLng}
        onClose={() => {
          setActiveTab("map");
          setPendingLatLng(null);
        }}
        onSubmitted={() => {
          setActiveTab("map");
          setPendingLatLng(null);
        }}
      />

      {isMemories && <MemoriesPanel onSelect={setSelectedPinId} />}

      <BottomNav active={activeTab} onChange={setActiveTab} />
    </main>
  );
}

function MemoriesPanel({
  onSelect,
}: {
  onSelect: (pinId: string) => void;
}) {
  const { data: pins } = usePins();

  const done = useMemo<Pin[]>(() => {
    return (pins ?? [])
      .filter((p) => p.is_done && p.done_at)
      .sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));
  }, [pins]);

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 z-30 overflow-y-auto bg-zinc-950 pb-28 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="text-2xl font-semibold text-white">Memories</h2>
        <p className="mt-1 text-sm text-zinc-400">
          {done.length} memor{done.length === 1 ? "y" : "ies"}
        </p>

        {done.length === 0 ? (
          <p className="mt-12 text-center text-sm text-zinc-500">
            Mark a pin as done to add a memory.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {done.map((pin) => (
              <MemoryCard key={pin.id} pin={pin} onClick={() => onSelect(pin.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MemoryCard({ pin, onClick }: { pin: Pin; onClick: () => void }) {
  const cover = pin.image_urls?.[0];
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 text-left transition-colors hover:border-zinc-700"
    >
      <div className="aspect-square w-full bg-zinc-800">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={pin.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-600">
            No photo
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <div className="line-clamp-1 text-sm font-medium text-white">
          {pin.title}
        </div>
        {pin.memory && (
          <p className="line-clamp-2 text-xs text-zinc-400">{pin.memory}</p>
        )}
        {pin.done_at && (
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">
            {new Date(pin.done_at).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </div>
        )}
      </div>
    </button>
  );
}
