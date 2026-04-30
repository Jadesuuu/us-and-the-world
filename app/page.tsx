"use client";

import { useMemo, useRef, useState } from "react";
import Map, { type LatLng, type MapHandle } from "@/components/Map";
import PinDrawer, { ordinalTimeLabel } from "@/components/PinDrawer";
import AddPinDrawer from "@/components/AddPinDrawer";
import BottomNav, { type Tab } from "@/components/BottomNav";
import SettingsDrawer from "@/components/SettingsDrawer";
import SearchControl, {
  type ResolvedPlace,
} from "@/components/SearchControl";
import PlacePreviewSheet from "@/components/PlacePreviewSheet";
import { usePins } from "@/hooks/usePins";
import { useAllVisits, type VisitWithPin } from "@/hooks/useAllVisits";
import { formatLongDate } from "@/lib/format";
import { findExistingPin } from "@/lib/geo";
import { toast } from "sonner";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("map");
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [pendingLatLng, setPendingLatLng] = useState<LatLng | null>(null);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [previewPlace, setPreviewPlace] = useState<ResolvedPlace | null>(null);
  const [pendingPrefillTitle, setPendingPrefillTitle] = useState<string>("");
  const [searchFocused, setSearchFocused] = useState(false);

  const mapHandle = useRef<MapHandle>(null);

  const { data: pins } = usePins();
  const selectedPin = pins?.find((p) => p.id === selectedPinId) ?? null;

  // Memoized so the Map's camera effect only re-fires when the selection
  // actually changes, not on every parent render.
  const selectedLatLng = useMemo(() => {
    if (!selectedPin || selectedPin.lat == null || selectedPin.lng == null) {
      return null;
    }
    return { lat: selectedPin.lat, lng: selectedPin.lng };
  }, [selectedPin?.id, selectedPin?.lat, selectedPin?.lng]);

  const isAddOpen = activeTab === "add";
  const isMemories = activeTab === "memories";
  const isMap = activeTab === "map";

  function handleSubmitted(newId: string) {
    setRecentlyAddedId(newId);
    setTimeout(() => setRecentlyAddedId(null), 500);
    setActiveTab("map");
    setPendingLatLng(null);
    setPendingPrefillTitle("");
  }

  function handlePlacePick(place: ResolvedPlace) {
    // If we already have a pin within 25m of this Google place, skip
    // the preview entirely and open the existing pin's drawer. This is
    // the soft "we already pinned this" path — the user lands on the
    // existing memory rather than creating a duplicate.
    const existing = findExistingPin(
      { lat: place.lat, lng: place.lng },
      pins,
    );
    if (existing) {
      setPreviewPlace(null);
      setSelectedPinId(existing.id);
      mapHandle.current?.flyTo(
        { lat: existing.lat ?? place.lat, lng: existing.lng ?? place.lng },
        16,
      );
      toast(`Already in your list — opening ${existing.title}`);
      return;
    }

    setSelectedPinId(null);
    setPreviewPlace(place);
    mapHandle.current?.flyTo({ lat: place.lat, lng: place.lng }, 16);
  }

  function handlePlaceDrop() {
    if (!previewPlace) return;
    const latlng = { lat: previewPlace.lat, lng: previewPlace.lng };
    const title = previewPlace.name;
    setPreviewPlace(null);
    setPendingLatLng(latlng);
    setPendingPrefillTitle(title);
    setActiveTab("add");
  }

  return (
    <main className="relative flex flex-1">
      <Map
        ref={mapHandle}
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
        previewLatLng={
          previewPlace
            ? { lat: previewPlace.lat, lng: previewPlace.lng }
            : null
        }
        selectedLatLng={selectedLatLng}
        recentlyAddedId={recentlyAddedId}
      />

      {isMap && (
        <SearchControl
          onPick={handlePlacePick}
          onFocusChange={setSearchFocused}
        />
      )}

      <button
        type="button"
        aria-label="Settings"
        onClick={() => setSettingsOpen(true)}
        className="fixed right-4 top-[max(env(safe-area-inset-top),1rem)] z-30 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink"
        style={{ border: "1px solid var(--border)" }}
      >
        <span aria-hidden className="text-lg leading-none tracking-widest">
          ···
        </span>
      </button>

      <PinDrawer
        pin={isAddOpen ? null : selectedPin}
        onClose={() => setSelectedPinId(null)}
        readOnly={isMemories}
      />

      <AddPinDrawer
        open={isAddOpen}
        pendingLatLng={pendingLatLng}
        prefillTitle={pendingPrefillTitle || undefined}
        onClose={() => {
          setActiveTab("map");
          setPendingLatLng(null);
          setPendingPrefillTitle("");
        }}
        onSubmitted={handleSubmitted}
        onOpenExistingPin={(pinId) => {
          setActiveTab("map");
          setPendingLatLng(null);
          setPendingPrefillTitle("");
          setSelectedPinId(pinId);
        }}
      />

      <PlacePreviewSheet
        place={previewPlace}
        onClose={() => setPreviewPlace(null)}
        onDropDream={handlePlaceDrop}
      />

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {isMemories && <MemoriesPanel onSelect={setSelectedPinId} />}

      <BottomNav
        active={activeTab}
        onChange={setActiveTab}
        hidden={isMap && searchFocused}
      />
    </main>
  );
}

function MemoriesPanel({
  onSelect,
}: {
  onSelect: (pinId: string) => void;
}) {
  const { data: visits = [] } = useAllVisits();

  // Visits already arrive newest-first. The "Nth time" label is computed
  // per-pin from the chronological (ascending) order.
  const ordinalById = useMemo(() => {
    const byPin: Record<string, VisitWithPin[]> = {};
    visits.forEach((v) => {
      (byPin[v.pin_id] ??= []).push(v);
    });
    const m: Record<string, number> = {};
    Object.values(byPin).forEach((pinVisits) => {
      const asc = [...pinVisits].sort((a, b) =>
        a.visited_at.localeCompare(b.visited_at),
      );
      asc.forEach((v, i) => {
        m[v.id] = i + 1;
      });
    });
    return m;
  }, [visits]);

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 z-30 overflow-y-auto bg-bg pb-28 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="font-display italic text-[22px] font-medium text-ink">
          Lived
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          {visits.length} visit{visits.length === 1 ? "" : "s"}
        </p>

        {visits.length === 0 ? (
          <p className="mt-16 text-center font-display italic text-lg text-ink-soft">
            Nothing here yet — go make one.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {visits.map((v) => (
              <VisitCard
                key={v.id}
                visit={v}
                ordinal={ordinalById[v.id] ?? 1}
                onClick={() => onSelect(v.pin_id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VisitCard({
  visit,
  ordinal,
  onClick,
}: {
  visit: VisitWithPin;
  ordinal: number;
  onClick: () => void;
}) {
  const cover = visit.visit_photos?.[0]?.image_url;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col overflow-hidden rounded-xl bg-surface text-left"
      style={{ border: "1px solid var(--border)" }}
    >
      <div className="aspect-square w-full bg-surface">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={visit.pin?.title ?? ""}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-display italic text-sm text-ink-soft">
            no photo
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <div className="text-[10px] uppercase tracking-wider text-accent">
          {ordinalTimeLabel(ordinal)}
        </div>
        <div className="line-clamp-1 font-display italic text-[16px] leading-tight text-ink">
          {visit.pin?.title ?? "Untitled"}
        </div>
        {visit.note && (
          <p className="line-clamp-2 font-handwritten text-[15px] leading-snug text-ink">
            {visit.note}
          </p>
        )}
        <div className="mt-1 text-[11px] text-ink-soft">
          {formatLongDate(visit.visited_at)}
        </div>
      </div>
    </button>
  );
}
