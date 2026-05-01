"use client";

import { useMemo, useRef, useState } from "react";
import Map, { type LatLng, type MapHandle } from "@/components/Map";
import PinDrawer, { ordinalTimeLabel } from "@/components/PinDrawer";
import ImageLightbox from "@/components/ImageLightbox";
import type { VisitPhoto } from "@/hooks/usePinVisits";
import AddPinDrawer from "@/components/AddPinDrawer";
import BottomNav, { type Tab } from "@/components/BottomNav";
import SettingsDrawer from "@/components/SettingsDrawer";
import SearchControl, {
  type ResolvedPlace,
} from "@/components/SearchControl";
import PlacePreviewSheet from "@/components/PlacePreviewSheet";
import DesktopLayout from "@/components/desktop/DesktopLayout";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { usePins } from "@/hooks/usePins";
import { useAllVisits, type VisitWithPin } from "@/hooks/useAllVisits";
import { formatLongDate } from "@/lib/format";
import { findExistingPin } from "@/lib/geo";
import { toast } from "sonner";

export default function Home() {
  const isDesktop = useIsDesktop();

  // Shared state, owned at the page level so both layouts agree on
  // current selection / pending pin / preview place.
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

  function handleMapClick(latlng: LatLng) {
    if (isAddOpen) {
      setPendingLatLng(latlng);
    } else if (selectedPinId) {
      setSelectedPinId(null);
    }
  }

  function handleMarkerClick(id: string) {
    setActiveTab("map");
    setPendingLatLng(null);
    setSettingsOpen(false);
    setPreviewPlace(null);
    setSelectedPinId(id);
  }

  function handleOpenExistingFromAdd(pinId: string) {
    setActiveTab("map");
    setPendingLatLng(null);
    setPendingPrefillTitle("");
    setSettingsOpen(false);
    setSelectedPinId(pinId);
  }

  // Mutual-exclusivity helpers — opening any drawer closes the others
  // so two drawers can never overlap on screen at once.
  function openSettings() {
    setSelectedPinId(null);
    setPreviewPlace(null);
    setActiveTab("map");
    setPendingLatLng(null);
    setPendingPrefillTitle("");
    setSettingsOpen(true);
  }

  function handleBottomNavChange(t: Tab) {
    if (t === "add") {
      setSelectedPinId(null);
      setPreviewPlace(null);
      setSettingsOpen(false);
    }
    setActiveTab(t);
  }

  // Drawer-open signal for the map gesture lock. selectedLatLng-driven
  // locking is handled inside Map.tsx; here we only flag the drawers
  // that aren't otherwise represented in selectedLatLng.
  const mapLocked =
    settingsOpen || previewPlace != null || (isAddOpen && !pendingLatLng);
  // Note on the AddPinDrawer half: we INTENTIONALLY don't lock once
  // the user has placed a pendingLatLng, because they might want to
  // adjust by tapping the map again. The "tap to set" stage is when
  // accidental drag is most disorienting.

  // ============================================================
  // Desktop layout
  // ============================================================
  if (isDesktop) {
    return (
      <DesktopLayout
        mapRef={mapHandle}
        selectedPin={selectedPin}
        selectedLatLng={selectedLatLng}
        isAddOpen={isAddOpen}
        pendingLatLng={pendingLatLng}
        pendingPrefillTitle={pendingPrefillTitle}
        recentlyAddedId={recentlyAddedId}
        previewPlace={previewPlace}
        onMarkerClick={handleMarkerClick}
        onMapClick={handleMapClick}
        onSelectPin={(id) => {
          setActiveTab("map");
          setPendingLatLng(null);
          setSelectedPinId(id);
        }}
        onCloseDetail={() => setSelectedPinId(null)}
        onOpenAdd={() => {
          setSelectedPinId(null);
          setPreviewPlace(null);
          setActiveTab("add");
        }}
        onCloseAdd={() => {
          setActiveTab("map");
          setPendingLatLng(null);
          setPendingPrefillTitle("");
        }}
        onSubmittedAdd={handleSubmitted}
        onOpenExistingFromAdd={handleOpenExistingFromAdd}
        onPlacePick={handlePlacePick}
        onClosePreview={() => setPreviewPlace(null)}
        onDropDreamFromPreview={handlePlaceDrop}
      />
    );
  }

  // ============================================================
  // Mobile layout (unchanged)
  // ============================================================
  return (
    <main className="relative flex flex-1">
      <Map
        ref={mapHandle}
        onMarkerClick={handleMarkerClick}
        onMapClick={handleMapClick}
        pendingLatLng={isAddOpen ? pendingLatLng : null}
        previewLatLng={
          previewPlace
            ? { lat: previewPlace.lat, lng: previewPlace.lng }
            : null
        }
        selectedLatLng={selectedLatLng}
        recentlyAddedId={recentlyAddedId}
        mapLocked={mapLocked}
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
        onClick={openSettings}
        className="fixed right-4 top-[max(env(safe-area-inset-top),1rem)] z-20 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink"
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
        onOpenExistingPin={handleOpenExistingFromAdd}
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
        onChange={handleBottomNavChange}
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

  // Photo lightbox is scoped to the visit whose photo was tapped —
  // one visit's photos at a time, never combined across visits per
  // the design constraint.
  const [lightbox, setLightbox] = useState<{
    photos: VisitPhoto[];
    index: number;
  } | null>(null);

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
                onOpenPhoto={() =>
                  setLightbox({ photos: v.visit_photos ?? [], index: 0 })
                }
              />
            ))}
          </div>
        )}
      </div>

      <ImageLightbox
        photos={(lightbox?.photos ?? []).map((p) => ({
          url: p.image_url,
        }))}
        initialIndex={lightbox?.index ?? 0}
        open={lightbox != null}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}

function VisitCard({
  visit,
  ordinal,
  onClick,
  onOpenPhoto,
}: {
  visit: VisitWithPin;
  ordinal: number;
  onClick: () => void;
  onOpenPhoto: () => void;
}) {
  const cover = visit.visit_photos?.[0]?.image_url;
  // Photo region and text region are sibling buttons inside a div so
  // tapping the photo opens the lightbox while tapping the text
  // navigates to the pin — no nested-button HTML invalidity.
  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl bg-surface"
      style={{ border: "1px solid var(--border)" }}
    >
      {cover ? (
        <button
          type="button"
          onClick={onOpenPhoto}
          aria-label="View photo"
          className="aspect-square w-full bg-surface"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt={visit.pin?.title ?? ""}
            className="h-full w-full object-cover"
          />
        </button>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-surface font-display italic text-sm text-ink-soft">
          no photo
        </div>
      )}
      <button
        type="button"
        onClick={onClick}
        className="flex w-full flex-col text-left"
      >
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
    </div>
  );
}
