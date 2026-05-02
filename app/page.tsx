"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Map, { type LatLng, type MapHandle } from "@/components/Map";
import PinDrawer, { ordinalTimeLabel } from "@/components/PinDrawer";
import ImageLightbox from "@/components/ImageLightbox";
import { VisitNotes, type VisitNoteEntry } from "@/components/ui/VisitNotes";
import { MemorySearch } from "@/components/ui/MemorySearch";
import type { VisitPhoto } from "@/hooks/usePinVisits";
import { useLivedEntries, type LivedEntry } from "@/hooks/useLivedEntries";
import { useProfiles, type Profile } from "@/hooks/useProfiles";
import AddPinDrawer from "@/components/AddPinDrawer";
import BottomNav, { type Tab } from "@/components/BottomNav";
import SettingsDrawer from "@/components/SettingsDrawer";
import SearchControl, {
  type ResolvedPlace,
} from "@/components/SearchControl";
import PlacePreviewSheet from "@/components/PlacePreviewSheet";
import DesktopLayout from "@/components/desktop/DesktopLayout";
import { SELECT_PIN_EVENT } from "@/components/RealtimeBridge";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { usePins } from "@/hooks/usePins";
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

  // Three entry points all converge on "open this pin":
  //   1. Realtime toast "Open" action  → window CustomEvent
  //   2. Push-notification click on an open tab  → SW postMessage
  //   3. Push-notification click on a fresh tab  → ?pin=<id> URL param
  useEffect(() => {
    function selectPinById(pinId: string) {
      const pin = pins?.find((p) => p.id === pinId);
      if (!pin) return;
      handleMarkerClick(pinId);
      if (pin.lat != null && pin.lng != null) {
        mapHandle.current?.flyTo({ lat: pin.lat, lng: pin.lng });
      }
    }

    function onSelectPinEvent(e: Event) {
      const ce = e as CustomEvent<string>;
      if (typeof ce.detail === "string") selectPinById(ce.detail);
    }

    function onSwMessage(e: MessageEvent) {
      const data = e.data as { type?: string; pinId?: string } | null;
      if (data?.type === "jf:select-pin" && typeof data.pinId === "string") {
        selectPinById(data.pinId);
      }
    }

    window.addEventListener(SELECT_PIN_EVENT, onSelectPinEvent);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onSwMessage);
    }

    // Honor the deep-link URL param once pins have loaded. We strip the
    // param from the address bar so reloads don't re-fire the open.
    const urlPinId = new URLSearchParams(window.location.search).get("pin");
    if (urlPinId && pins) {
      selectPinById(urlPinId);
      const url = new URL(window.location.href);
      url.searchParams.delete("pin");
      window.history.replaceState({}, "", url.toString());
    }

    return () => {
      window.removeEventListener(SELECT_PIN_EVENT, onSelectPinEvent);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onSwMessage);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins]);

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
  const { entries } = useLivedEntries();
  const { data: profiles } = useProfiles();
  const [query, setQuery] = useState("");

  // Lightbox photos are merged across the entry's visits in
  // chronological order — same as the day-group strip in PinDrawer,
  // so opening a card's photo navigates the entire day's roll.
  const [lightbox, setLightbox] = useState<{
    photos: VisitPhoto[];
    index: number;
  } | null>(null);

  const profilesByUser = useMemo(() => {
    const m: Record<string, Profile> = {};
    (profiles ?? []).forEach((p) => {
      m[p.user_id] = p;
    });
    return m;
  }, [profiles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.pinTitle.toLowerCase().includes(q));
  }, [query, entries]);

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 z-30 overflow-y-auto bg-bg pb-28 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="font-display italic text-[22px] font-medium text-ink">
          Lived
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          {entries.length} {entries.length === 1 ? "memory" : "memories"}
        </p>

        <div className="mt-4">
          <MemorySearch value={query} onChange={setQuery} />
        </div>

        {entries.length === 0 ? (
          <p className="mt-16 text-center font-display italic text-lg text-ink-soft">
            Nothing here yet — go make one.
          </p>
        ) : filtered.length === 0 ? (
          <NoMatchEmptyState query={query} />
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {filtered.map((entry) => (
              <VisitCard
                key={entry.key}
                entry={entry}
                profilesByUser={profilesByUser}
                onClick={() => onSelect(entry.pinId)}
                onOpenPhoto={(photos, index) =>
                  setLightbox({ photos, index })
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

function NoMatchEmptyState({ query }: { query: string }) {
  return (
    <div className="mt-16 flex flex-col items-center justify-center text-center">
      <p className="font-display italic text-[20px] text-ink">
        no memories of {query.trim()} yet
      </p>
      <p className="mt-2 font-body text-[14px] text-ink-soft">
        try a different name
      </p>
    </div>
  );
}

function VisitCard({
  entry,
  profilesByUser,
  onClick,
  onOpenPhoto,
}: {
  entry: LivedEntry;
  profilesByUser: Record<string, Profile>;
  onClick: () => void;
  onOpenPhoto: (photos: VisitPhoto[], index: number) => void;
}) {
  // Merge photos across all visits in the day, ordered by parent
  // visited_at then photo created_at — same flatten as the day-group
  // strip in PinDrawer, so the lightbox shows the same set.
  const photos = useMemo(() => {
    const flat: { photo: VisitPhoto; visitedAt: string }[] = [];
    for (const v of entry.visits) {
      for (const p of v.visit_photos) {
        flat.push({ photo: p, visitedAt: v.visited_at });
      }
    }
    flat.sort((a, b) => {
      const t = a.visitedAt.localeCompare(b.visitedAt);
      if (t !== 0) return t;
      return a.photo.created_at.localeCompare(b.photo.created_at);
    });
    return flat.map((x) => x.photo);
  }, [entry.visits]);
  const cover = photos[0]?.image_url;

  // Notes for the day, attributed. VisitNotes hides labels when only
  // one author wrote, matches the in-drawer treatment.
  const noteEntries = useMemo<VisitNoteEntry[]>(() => {
    return entry.visits
      .filter((v) => v.note?.trim())
      .map((v) => ({
        id: v.id,
        note: v.note!.trim(),
        authorName: v.created_by
          ? profilesByUser[v.created_by]?.display_name ?? "Someone"
          : "Someone",
        visitedAt: v.visited_at,
      }));
  }, [entry.visits, profilesByUser]);

  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl bg-surface"
      style={{ border: "1px solid var(--border)" }}
    >
      {cover ? (
        <button
          type="button"
          onClick={() => onOpenPhoto(photos, 0)}
          aria-label="View photo"
          className="aspect-square w-full bg-surface"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt={entry.pinTitle}
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
            {ordinalTimeLabel(entry.ordinal)}
          </div>
          <div className="line-clamp-1 font-display italic text-[16px] leading-tight text-ink">
            {entry.pinTitle}
          </div>
          {noteEntries.length > 0 && (
            <div className="max-h-[3.4rem] overflow-hidden">
              <VisitNotes notes={noteEntries} />
            </div>
          )}
          <div className="mt-1 text-[11px] text-ink-soft">
            {formatLongDate(entry.visitedAt)}
          </div>
        </div>
      </button>
    </div>
  );
}
