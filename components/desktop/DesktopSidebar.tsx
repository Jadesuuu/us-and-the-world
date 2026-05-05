"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, MapPin } from "lucide-react";
import { PinContent } from "@/components/PinDrawer";
import { AddPinForm } from "@/components/AddPinDrawer";
import { PreviewBody } from "@/components/PlacePreviewSheet";
import { MemorySearch } from "@/components/ui/MemorySearch";
import { usePins, type Pin } from "@/hooks/usePins";
import {
  useLivedEntries,
  type LivedEntry,
} from "@/hooks/useLivedEntries";
import { formatLongDate } from "@/lib/format";
import type { ResolvedPlace } from "@/components/SearchControl";
import type { LatLng } from "@/components/Map";
import {
  useScrollShadows,
  SCROLL_SHADOW_TOP,
  SCROLL_SHADOW_BOTTOM,
} from "@/lib/use-scroll-shadows";

type SidebarTab = "dreaming" | "lived";
type SidebarMode = "list" | "detail" | "add" | "preview";

interface Props {
  selectedPin: Pin | null;
  isAddOpen: boolean;
  pendingLatLng: LatLng | null;
  pendingPrefillTitle: string;
  pendingPrefillPlaceId: string | null;
  previewPlace: ResolvedPlace | null;

  onSelectPin: (pinId: string) => void;
  onCloseDetail: () => void;
  onOpenAdd: () => void;
  onCloseAdd: () => void;
  onSubmittedAdd: (newPinId: string) => void;
  onOpenExistingFromAdd: (pinId: string) => void;
  onClosePreview: () => void;
  onDropDreamFromPreview: () => void;
}

export default function DesktopSidebar(props: Props) {
  const {
    selectedPin,
    isAddOpen,
    pendingLatLng,
    pendingPrefillTitle,
    pendingPrefillPlaceId,
    previewPlace,
    onSelectPin,
    onCloseDetail,
    onOpenAdd,
    onCloseAdd,
    onSubmittedAdd,
    onOpenExistingFromAdd,
    onClosePreview,
    onDropDreamFromPreview,
  } = props;

  const [tab, setTab] = useState<SidebarTab>("dreaming");

  // Mode derives from external state. Order matters: detail wins over
  // add/preview if a pin is selected; add wins over preview otherwise.
  const mode: SidebarMode = selectedPin
    ? "detail"
    : isAddOpen
      ? "add"
      : previewPlace
        ? "preview"
        : "list";

  return (
    <aside
      className="flex h-full w-[380px] shrink-0 flex-col overflow-hidden bg-surface"
      style={{ borderRight: "0.5px solid var(--border)" }}
    >
      {mode === "list" && (
        <ListMode
          tab={tab}
          onTabChange={setTab}
          onSelectPin={onSelectPin}
          onOpenAdd={onOpenAdd}
        />
      )}

      {mode === "detail" && selectedPin && (
        <PanelMode label="all pins" onBack={onCloseDetail}>
          <PinContent
            layout="panel"
            pin={selectedPin}
            readOnly={false}
            onClose={onCloseDetail}
          />
        </PanelMode>
      )}

      {mode === "add" && (
        <PanelMode label="cancel" onBack={onCloseAdd}>
          <AddPinForm
            layout="panel"
            pendingLatLng={pendingLatLng}
            prefillTitle={pendingPrefillTitle || undefined}
            prefillPlaceId={pendingPrefillPlaceId}
            onClose={onCloseAdd}
            onSubmitted={onSubmittedAdd}
            onOpenExistingPin={onOpenExistingFromAdd}
          />
        </PanelMode>
      )}

      {mode === "preview" && previewPlace && (
        <PanelMode label="back" onBack={onClosePreview}>
          <PreviewBody
            place={previewPlace}
            onDropDream={onDropDreamFromPreview}
            layout="panel"
          />
        </PanelMode>
      )}
    </aside>
  );
}

// ============================================================
// List mode — tabs + scrollable list + Drop-a-dream footer
// ============================================================

function ListMode({
  tab,
  onTabChange,
  onSelectPin,
  onOpenAdd,
}: {
  tab: SidebarTab;
  onTabChange: (t: SidebarTab) => void;
  onSelectPin: (pinId: string) => void;
  onOpenAdd: () => void;
}) {
  const { topSentinelRef, bottomSentinelRef, topShadow, bottomShadow } =
    useScrollShadows();

  return (
    <>
      <div
        className="shrink-0 bg-surface"
        style={{
          boxShadow: topShadow ? SCROLL_SHADOW_TOP : "none",
          transition: "box-shadow 200ms ease-out",
          zIndex: 1,
        }}
      >
        <TabStrip tab={tab} onChange={onTabChange} />
      </div>

      <div
        className="sidebar-scroll flex-1 overflow-y-auto"
        style={{ minHeight: 0 }}
      >
        <div ref={topSentinelRef} style={{ height: 1 }} />
        {tab === "dreaming" ? (
          <DreamingList onSelectPin={onSelectPin} />
        ) : (
          <LivedList onSelectPin={onSelectPin} />
        )}
        <div ref={bottomSentinelRef} style={{ height: 1 }} />
      </div>

      <div
        className="shrink-0 bg-surface p-4"
        style={{
          borderTop: "0.5px solid var(--border)",
          boxShadow: bottomShadow ? SCROLL_SHADOW_BOTTOM : "none",
          transition: "box-shadow 200ms ease-out",
        }}
      >
        <button
          type="button"
          onClick={onOpenAdd}
          className="h-12 w-full rounded-lg bg-accent font-display italic text-[18px] text-bg"
        >
          Drop a dream
        </button>
      </div>
    </>
  );
}

function TabStrip({
  tab,
  onChange,
}: {
  tab: SidebarTab;
  onChange: (t: SidebarTab) => void;
}) {
  return (
    <div className="px-4 pt-4 pb-3">
      <div
        role="tablist"
        className="flex gap-1 rounded-full bg-bg p-1"
        style={{ border: "0.5px solid var(--border)" }}
      >
        <TabButton
          label="Dreaming"
          active={tab === "dreaming"}
          onClick={() => onChange("dreaming")}
        />
        <TabButton
          label="Lived"
          active={tab === "lived"}
          onClick={() => onChange("lived")}
        />
      </div>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 h-9 rounded-full font-display text-[15px] transition-colors ${
        active
          ? "italic bg-accent text-bg"
          : "text-ink-soft hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

// ============================================================
// Panel mode — back arrow + body
// ============================================================

// PanelMode is just a back-button strip + a flex-column body slot.
// It deliberately does NOT scroll — each consumer is responsible for
// rendering its own scrollable region + sticky footer inside the body
// slot. That avoids nested overflow:auto (which steals the wheel
// event from the actual scrollable region) and lets the body component
// own its own header/footer split.
function PanelMode({
  label,
  onBack,
  children,
}: {
  label: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        className="shrink-0 bg-surface px-4 py-3"
        style={{ borderBottom: "0.5px solid var(--border)" }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-[12px] text-ink-soft hover:text-ink"
        >
          <ChevronLeft size={14} aria-hidden />
          <span>{label}</span>
        </button>
      </div>
      <div
        className="flex flex-1 flex-col"
        style={{ minHeight: 0 }}
      >
        {children}
      </div>
    </>
  );
}

// ============================================================
// Dreaming list
// ============================================================

function DreamingList({ onSelectPin }: { onSelectPin: (id: string) => void }) {
  const { data: pins, isLoading } = usePins();

  if (isLoading) {
    return (
      <p className="px-5 py-6 font-display italic text-sm text-ink-soft">
        loading…
      </p>
    );
  }
  if (!pins || pins.length === 0) {
    return (
      <p className="px-5 py-10 text-center font-display italic text-base text-ink-soft">
        Nothing yet — drop your first dream.
      </p>
    );
  }

  return (
    <ul className="flex flex-col py-1">
      {pins.map((pin) => (
        <PinRow key={pin.id} pin={pin} onClick={() => onSelectPin(pin.id)} />
      ))}
    </ul>
  );
}

function PinRow({ pin, onClick }: { pin: Pin; onClick: () => void }) {
  const thumb = pin.image_urls[0];
  const subtitle = useMemo(() => pinSubtitle(pin), [pin]);

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 px-[14px] py-3 text-left hover:bg-ink/5"
      >
        <Thumb src={thumb} alt={pin.title} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[16px] leading-tight text-ink">
            {pin.title}
          </div>
          {subtitle && (
            <div className="mt-0.5 truncate font-body text-[12px] text-ink-soft">
              {subtitle}
            </div>
          )}
        </div>
        {pin.has_visits && <LivedPill />}
      </button>
    </li>
  );
}

function pinSubtitle(pin: Pin): string {
  // First non-empty line of the note is the most human description we
  // have without a reverse-geocoder. Falls back to a compact coord pair.
  const firstLine = pin.note?.split("\n").find((l) => l.trim());
  if (firstLine) return firstLine.trim();
  if (pin.lat != null && pin.lng != null) {
    return `${pin.lat.toFixed(1)}°, ${pin.lng.toFixed(1)}°`;
  }
  return "";
}

function LivedPill() {
  return (
    <span
      className="shrink-0 rounded-full px-2 py-[3px] font-body text-[11px]"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--accent-2) 22%, transparent)",
        color: "var(--accent-2)",
        border: "0.5px solid var(--accent-2)",
      }}
    >
      ✓ lived
    </span>
  );
}

// ============================================================
// Lived list — chronological visits
// ============================================================

function LivedList({ onSelectPin }: { onSelectPin: (id: string) => void }) {
  const { entries, isLoading } = useLivedEntries();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.pinTitle.toLowerCase().includes(q));
  }, [query, entries]);

  return (
    <>
      <div className="px-4 pt-3">
        <MemorySearch value={query} onChange={setQuery} />
      </div>

      {isLoading ? (
        <p className="px-5 py-6 font-display italic text-sm text-ink-soft">
          loading…
        </p>
      ) : entries.length === 0 ? (
        <p className="px-5 py-10 text-center font-display italic text-base text-ink-soft">
          Nothing here yet — go make one.
        </p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
          <p className="font-display italic text-[18px] text-ink">
            no memories of {query.trim()} yet
          </p>
          <p className="mt-1.5 font-body text-[13px] text-ink-soft">
            try a different name
          </p>
        </div>
      ) : (
        <ul className="flex flex-col py-2">
          {filtered.map((entry) => (
            <VisitRow
              key={entry.key}
              entry={entry}
              onClick={() => onSelectPin(entry.pinId)}
            />
          ))}
        </ul>
      )}
    </>
  );
}

// Lived sidebar row — fixed 80px tall mirror of the mobile card's
// fixed-height contract. Thumb fills the left 56x56, the right column
// takes the remaining width with title (clamp-1) + note (clamp-1) +
// date stacked vertically. Wider stories live in the pin detail.
function VisitRow({
  entry,
  onClick,
}: {
  entry: LivedEntry;
  onClick: () => void;
}) {
  const cover = useMemo(() => {
    for (const v of entry.visits) {
      for (const p of v.visit_photos) return p.image_url;
    }
    return undefined;
  }, [entry.visits]);

  const notePreview = useMemo(() => {
    for (const v of entry.visits) {
      const trimmed = v.note?.trim();
      if (trimmed) return trimmed;
    }
    return null;
  }, [entry.visits]);

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 px-[14px] text-left hover:bg-ink/5"
        style={{ height: 80, overflow: "hidden" }}
      >
        <Thumb src={cover} alt={entry.pinTitle} />
        <div
          className="flex min-w-0 flex-1 flex-col justify-center"
          style={{ overflow: "hidden" }}
        >
          <div className="line-clamp-1 font-display text-[15px] leading-tight text-ink">
            {entry.pinTitle}
          </div>
          {notePreview && (
            <div className="line-clamp-1 font-handwritten italic text-[12px] text-ink-soft">
              {notePreview}
            </div>
          )}
          <div className="font-body text-[11px] text-ink-soft">
            {formatLongDate(entry.visitedAt)}
          </div>
        </div>
      </button>
    </li>
  );
}

// ============================================================
// Thumbnail
// ============================================================

function Thumb({ src, alt }: { src: string | undefined; alt: string }) {
  if (src) {
    return (
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-bg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-bg"
      style={{ border: "0.5px solid var(--border)" }}
    >
      <MapPin size={20} className="text-ink-soft" aria-hidden />
    </div>
  );
}
