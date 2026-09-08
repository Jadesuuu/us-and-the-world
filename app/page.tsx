"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import Map, { type LatLng, type MapHandle } from "@/components/Map";
import PinDrawer, { ordinalTimeLabel } from "@/components/PinDrawer";
import ImageLightbox from "@/components/ImageLightbox";
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
import { IS_DEMO } from "@/lib/demo";
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
  const [pendingPrefillPlaceId, setPendingPrefillPlaceId] = useState<
    string | null
  >(null);
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
    setPendingPrefillPlaceId(null);
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
    const placeId = previewPlace.placeId;
    setPreviewPlace(null);
    setPendingLatLng(latlng);
    setPendingPrefillTitle(title);
    setPendingPrefillPlaceId(placeId);
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
    setPendingPrefillPlaceId(null);
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
    setPendingPrefillPlaceId(null);
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
        pendingPrefillPlaceId={pendingPrefillPlaceId}
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
          setPendingPrefillPlaceId(null);
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
  // Mobile layout
  // ============================================================
  // Map and Lived live as sibling flex children so the BottomNav (last
  // child of <main>) is always reachable. Map stays mounted under
  // display:none while Lived is active so Mapbox doesn't reinitialize.
  return (
    <main className="relative flex flex-1 flex-col">
      <div
        className="relative flex-1"
        style={{ display: isMemories ? "none" : "flex" }}
      >
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
      </div>

      {isMap && !IS_DEMO && (
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
        prefillPlaceId={pendingPrefillPlaceId}
        onClose={() => {
          setActiveTab("map");
          setPendingLatLng(null);
          setPendingPrefillTitle("");
          setPendingPrefillPlaceId(null);
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

      <MemoriesPanel
        onSelect={setSelectedPinId}
        hidden={!isMemories}
      />

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
  hidden,
}: {
  onSelect: (pinId: string) => void;
  hidden: boolean;
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

  // Two-layer container. The OUTER div is the flex item that takes its
  // share of <main>'s height (flex-1 + min-h-0) and clips with
  // overflow:hidden — without min-h-0 a column flex item defaults to
  // min-height:auto and grows to fit all content, defeating scroll.
  // The INNER div is the actual scroll container (h-full +
  // overflow-y:auto). Combining wrapper + scroller into one element
  // breaks momentum scroll on iOS when the same element is also a
  // column flex container, which is why this is split.
  return (
    <div
      className="relative flex-1 min-h-0 bg-bg"
      style={{
        display: hidden ? "none" : "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        className="h-full w-full overflow-y-auto pt-[max(env(safe-area-inset-top),1.5rem)]"
        style={{
          WebkitOverflowScrolling: "touch",
          paddingBottom: "calc(72px + env(safe-area-inset-bottom))",
          overscrollBehavior: "contain",
        }}
      >
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
      </div>

      <ImageLightbox
        photos={(lightbox?.photos ?? []).map((p) => ({
          url: p.image_url,
          attribution: p.attribution ?? undefined,
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

// VisitCard — fixed-dimension preview tile for the Lived grid.
// Every card is exactly 280px tall with a 140px photo strip on top
// and 140px clipped content beneath, so the grid stays uniform no
// matter how long titles or notes get. Two distinct tap targets:
// the photo opens the lightbox (chronological roll across the day's
// visits), the body opens the pin detail. Outer wrapper is a div
// because nested buttons aren't valid.
const CARD_HEIGHT = 280;
const PHOTO_HEIGHT = 140;

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

  // First non-empty note in the day — single visit days hand back
  // their only note, multi-visit days surface the earliest one. The
  // card is a preview, not the full record, so showing one is fine.
  const notePreview = useMemo(() => {
    for (const v of entry.visits) {
      const trimmed = v.note?.trim();
      if (trimmed) return trimmed;
    }
    return null;
  }, [entry.visits]);

  // Author label only when 2+ distinct people contributed visits to
  // this day — keeps single-author cards uncluttered while still
  // attributing collaborative days.
  const authorLabel = useMemo(() => {
    const distinctAuthors = new Set<string>();
    for (const v of entry.visits) {
      if (v.created_by) distinctAuthors.add(v.created_by);
    }
    // Demo builds always attribute — visitors can't tell the voices apart.
    if (distinctAuthors.size < 2 && !IS_DEMO) return null;
    const firstAuthorId = entry.visits.find((v) => v.created_by)?.created_by;
    if (!firstAuthorId) return null;
    return profilesByUser[firstAuthorId]?.display_name ?? null;
  }, [entry.visits, profilesByUser]);

  return (
    <div
      className="flex flex-col rounded-xl bg-surface"
      style={{
        height: CARD_HEIGHT,
        overflow: "hidden",
        border: "1px solid var(--border)",
      }}
    >
      {cover ? (
        <button
          type="button"
          onClick={() => onOpenPhoto(photos, 0)}
          aria-label="View photo"
          className="w-full shrink-0 bg-surface"
          style={{ height: PHOTO_HEIGHT }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt={entry.pinTitle}
            className="h-full w-full object-cover"
          />
        </button>
      ) : (
        <div
          className="flex w-full shrink-0 items-center justify-center bg-surface"
          style={{ height: PHOTO_HEIGHT }}
        >
          <MapPin
            size={28}
            aria-hidden
            style={{ color: "var(--ink-soft)", opacity: 0.5 }}
          />
        </div>
      )}
      <button
        type="button"
        onClick={onClick}
        className="flex w-full flex-col text-left"
        style={{
          height: CARD_HEIGHT - PHOTO_HEIGHT,
          padding: "10px 12px",
          overflow: "hidden",
        }}
      >
        <div className="font-body text-[10px] uppercase tracking-wider text-ink-soft">
          {ordinalTimeLabel(entry.ordinal)}
        </div>
        <div
          className="line-clamp-1 font-display italic leading-tight text-ink"
          style={{ fontSize: 15, marginTop: 2 }}
        >
          {entry.pinTitle}
        </div>
        {authorLabel && (
          <div
            className="font-body text-[10px] uppercase tracking-wider text-ink-soft"
            style={{ marginTop: 2 }}
          >
            {authorLabel}
          </div>
        )}
        {notePreview && (
          <p
            className="font-handwritten italic text-[13px] leading-snug text-ink"
            style={{
              marginTop: 4,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              WebkitMaskImage:
                "linear-gradient(to bottom, black 60%, transparent 100%)",
              maskImage:
                "linear-gradient(to bottom, black 60%, transparent 100%)",
            }}
          >
            {notePreview}
          </p>
        )}
        <div
          className="font-body text-[11px] text-ink-soft"
          style={{ marginTop: "auto" }}
        >
          {formatLongDate(entry.visitedAt)}
        </div>
      </button>
    </div>
  );
}
