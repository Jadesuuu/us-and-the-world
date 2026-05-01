"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, MapPin } from "lucide-react";
import { PinContent } from "@/components/PinDrawer";
import { AddPinForm } from "@/components/AddPinDrawer";
import { PreviewBody } from "@/components/PlacePreviewSheet";
import ImageLightbox from "@/components/ImageLightbox";
import { usePins, type Pin } from "@/hooks/usePins";
import { useAllVisits, type VisitWithPin } from "@/hooks/useAllVisits";
import type { VisitPhoto } from "@/hooks/usePinVisits";
import { formatLongDate } from "@/lib/format";
import type { ResolvedPlace } from "@/components/SearchControl";
import type { LatLng } from "@/components/Map";

type SidebarTab = "dreaming" | "lived";
type SidebarMode = "list" | "detail" | "add" | "preview";

interface Props {
  selectedPin: Pin | null;
  isAddOpen: boolean;
  pendingLatLng: LatLng | null;
  pendingPrefillTitle: string;
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
      className="flex h-full w-[380px] shrink-0 flex-col bg-surface"
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
            titleAs="panel"
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
  return (
    <>
      <TabStrip tab={tab} onChange={onTabChange} />
      <div className="flex-1 overflow-y-auto">
        {tab === "dreaming" ? (
          <DreamingList onSelectPin={onSelectPin} />
        ) : (
          <LivedList onSelectPin={onSelectPin} />
        )}
      </div>
      <div
        className="shrink-0 p-4"
        style={{ borderTop: "0.5px solid var(--border)" }}
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
        className="shrink-0 px-4 py-3"
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
      <div className="flex-1 overflow-y-auto">{children}</div>
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
  const { data: visits, isLoading } = useAllVisits();

  // Lightbox is owned at the list level so opening a photo doesn't
  // depend on hover state or row focus. One visit's photos at a time.
  const [lightbox, setLightbox] = useState<{
    photos: VisitPhoto[];
    index: number;
  } | null>(null);

  if (isLoading) {
    return (
      <p className="px-5 py-6 font-display italic text-sm text-ink-soft">
        loading…
      </p>
    );
  }
  if (!visits || visits.length === 0) {
    return (
      <p className="px-5 py-10 text-center font-display italic text-base text-ink-soft">
        Nothing here yet — go make one.
      </p>
    );
  }

  return (
    <>
      <ul className="flex flex-col py-1">
        {visits.map((v) => (
          <VisitRow
            key={v.id}
            visit={v}
            onClick={() => onSelectPin(v.pin_id)}
            onOpenPhoto={() =>
              setLightbox({ photos: v.visit_photos, index: 0 })
            }
          />
        ))}
      </ul>

      <ImageLightbox
        photos={lightbox?.photos ?? []}
        initialIndex={lightbox?.index ?? 0}
        open={lightbox != null}
        onClose={() => setLightbox(null)}
      />
    </>
  );
}

function VisitRow({
  visit,
  onClick,
  onOpenPhoto,
}: {
  visit: VisitWithPin;
  onClick: () => void;
  onOpenPhoto: () => void;
}) {
  const cover = visit.visit_photos[0]?.image_url;
  // Same split-button pattern as mobile VisitCard: photo opens the
  // lightbox, the rest of the row navigates to the pin.
  return (
    <li className="flex items-center gap-3 px-[14px] py-3 hover:bg-ink/5">
      {cover ? (
        <button
          type="button"
          onClick={onOpenPhoto}
          aria-label="View photo"
          className="shrink-0"
        >
          <Thumb src={cover} alt={visit.pin?.title ?? ""} />
        </button>
      ) : (
        <Thumb src={undefined} alt="" />
      )}
      <button
        type="button"
        onClick={onClick}
        className="min-w-0 flex-1 text-left"
      >
        <div className="truncate font-display text-[16px] leading-tight text-ink">
          {visit.pin?.title ?? "Untitled"}
        </div>
        <div className="mt-0.5 truncate font-handwritten italic text-[13px] text-ink-soft">
          {formatLongDate(visit.visited_at)}
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
