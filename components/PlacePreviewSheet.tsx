"use client";

import { Drawer } from "vaul";
import { useState } from "react";
import type { PlaceReview, ResolvedPlace } from "./SearchControl";
import ImageLightbox, { type LightboxPhoto } from "./ImageLightbox";
import {
  useScrollShadows,
  SCROLL_SHADOW_TOP,
  SCROLL_SHADOW_BOTTOM,
} from "@/lib/use-scroll-shadows";

// Build the lightbox photo set from a place's Google Places refs.
// Strip uses the cheaper "thumb" size endpoint; lightbox loads "full".
// The proxy validates ref shape and gates size to a small allowlist
// (see app/api/place-photo/route.ts), so passing arbitrary string
// values through here is safe.
function placePhotosToLightbox(place: ResolvedPlace): LightboxPhoto[] {
  return place.photos.map((p) => {
    const ref = encodeURIComponent(p.ref);
    return {
      url: `/api/place-photo?ref=${ref}&size=full`,
      thumbnailUrl: `/api/place-photo?ref=${ref}&size=thumb`,
      alt: place.name,
      attribution: p.attribution,
    };
  });
}

interface Props {
  place: ResolvedPlace | null;
  onClose: () => void;
  onDropDream: () => void;
}

export default function PlacePreviewSheet({
  place,
  onClose,
  onDropDream,
}: Props) {
  return (
    <Drawer.Root
      open={place != null}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      modal
      dismissible
    >
      <Drawer.Portal>
        <Drawer.Overlay
          className="fixed inset-0 z-30"
          style={{ backgroundColor: "color-mix(in srgb, var(--ink) 25%, transparent)" }}
        />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-40 flex max-h-[80vh] flex-col rounded-t-3xl bg-surface outline-none"
          style={{ borderTop: "0.5px solid var(--border)" }}
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-ink-soft/40" />
          {place && (
            <PreviewBody
              place={place}
              onDropDream={onDropDream}
              layout="drawer"
            />
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

// Reusable body for the place preview.
//   layout="drawer" — single overflow-y-auto column with sticky
//     photos at the top and sticky drop-dream button at the bottom.
//     This is the mobile Vaul drawer's natural shape.
//   layout="panel" — flex column for the desktop sidebar: photos +
//     title in a fixed header, reviews in a scrollable middle, and
//     the drop-dream button pinned to the sidebar's bottom.
export function PreviewBody({
  place,
  onDropDream,
  layout,
}: {
  place: ResolvedPlace;
  onDropDream: () => void;
  layout: "drawer" | "panel";
}) {
  // Lightbox state is owned at the body level so both drawer and panel
  // layouts can render the same fullscreen viewer when a thumb is tapped.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const lightboxPhotos = placePhotosToLightbox(place);

  const lightboxNode = (
    <ImageLightbox
      photos={lightboxPhotos}
      initialIndex={lightboxIndex ?? 0}
      open={lightboxIndex != null}
      onClose={() => setLightboxIndex(null)}
    />
  );

  if (layout === "drawer") {
    return (
      <div
        className="flex flex-col overflow-y-auto"
        style={{ overscrollBehavior: "contain" }}
      >
        {place.photos.length > 0 && (
          <div className="sticky top-0 z-10 bg-surface px-5 pb-2 pt-3">
            <div className="flex gap-2 overflow-x-auto">
              {place.photos.map((p, i) => (
                <PreviewPhoto
                  key={p.ref}
                  ref_={p.ref}
                  onClick={() => setLightboxIndex(i)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="px-5 pt-3">
          <Drawer.Title className="font-display italic text-[22px] leading-tight text-ink">
            {place.name}
          </Drawer.Title>
          <PlaceMeta place={place} />
        </div>

        {place.reviews.length > 0 && (
          <div className="flex flex-col gap-2 px-5 pt-4">
            <h3 className="font-display italic text-[14px] text-ink-soft">
              What people said
            </h3>
            {place.reviews.map((r, i) => (
              <ReviewCard key={i} review={r} />
            ))}
          </div>
        )}

        <div
          className="sticky bottom-0 z-10 bg-surface px-5 pt-4 pb-[max(env(safe-area-inset-bottom),1.25rem)]"
          style={{ marginTop: 16 }}
        >
          <DropDreamButton onClick={onDropDream} />
        </div>
        {lightboxNode}
      </div>
    );
  }

  return (
    <>
      <PreviewPanelLayout
        place={place}
        onDropDream={onDropDream}
        onPhotoClick={(i) => setLightboxIndex(i)}
      />
      {lightboxNode}
    </>
  );
}

function PreviewPanelLayout({
  place,
  onDropDream,
  onPhotoClick,
}: {
  place: ResolvedPlace;
  onDropDream: () => void;
  onPhotoClick: (index: number) => void;
}) {
  const { topSentinelRef, bottomSentinelRef, topShadow, bottomShadow } =
    useScrollShadows();

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Header: photos + title + rating + address. Doesn't scroll. */}
      <div
        className="shrink-0 bg-surface"
        style={{ borderBottom: "0.5px solid var(--border)" }}
      >
        {place.photos.length > 0 && (
          <div className="px-5 pt-3 pb-2">
            <div className="flex gap-2 overflow-x-auto">
              {place.photos.map((p, i) => (
                <PreviewPhoto
                  key={p.ref}
                  ref_={p.ref}
                  onClick={() => onPhotoClick(i)}
                />
              ))}
            </div>
          </div>
        )}
        <div className="px-5 pb-3 pt-1">
          <h2 className="font-display italic text-[22px] leading-tight text-ink">
            {place.name}
          </h2>
          <PlaceMeta place={place} />
        </div>
      </div>

      {/* Scrollable reviews region. */}
      <div
        className="sidebar-scroll flex-1 overflow-y-auto"
        style={{
          minHeight: 0,
          boxShadow: topShadow ? SCROLL_SHADOW_TOP : "none",
          transition: "box-shadow 200ms ease-out",
        }}
      >
        <div ref={topSentinelRef} style={{ height: 1 }} />
        {place.reviews.length > 0 ? (
          <div className="flex flex-col gap-2 px-5 py-4">
            <h3 className="font-display italic text-[14px] text-ink-soft">
              What people said
            </h3>
            {place.reviews.map((r, i) => (
              <ReviewCard key={i} review={r} />
            ))}
          </div>
        ) : (
          <p className="px-5 py-6 font-display italic text-[14px] text-ink-soft">
            No reviews yet — be the first to dream here.
          </p>
        )}
        <div ref={bottomSentinelRef} style={{ height: 1 }} />
      </div>

      {/* Sticky footer. */}
      <div
        className="shrink-0 bg-surface px-5 py-4"
        style={{
          borderTop: "0.5px solid var(--border)",
          boxShadow: bottomShadow ? SCROLL_SHADOW_BOTTOM : "none",
          transition: "box-shadow 200ms ease-out",
        }}
      >
        <DropDreamButton onClick={onDropDream} />
      </div>
    </div>
  );
}

function PlaceMeta({ place }: { place: ResolvedPlace }) {
  return (
    <>
      {place.rating != null && (
        <div
          className="mt-1.5 flex items-center gap-2 text-[13px]"
          style={{ lineHeight: 1 }}
        >
          <Stars filled={place.rating} />
          <span className="text-ink">{place.rating.toFixed(1)}</span>
          {place.userRatingCount != null && place.userRatingCount > 0 && (
            <span className="text-ink-soft">
              ({place.userRatingCount.toLocaleString()})
            </span>
          )}
        </div>
      )}
      {place.address && (
        <p className="mt-1 truncate text-[13px] text-ink-soft">
          {place.address}
        </p>
      )}
    </>
  );
}

function DropDreamButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-12 w-full rounded-lg bg-accent font-display italic text-[16px] text-bg"
    >
      drop a dream here
    </button>
  );
}

export function PreviewPhoto({
  ref_,
  onClick,
}: {
  ref_: string;
  onClick: () => void;
}) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  if (state === "error") return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="View photo"
      className="group shrink-0 overflow-hidden rounded-lg outline-none ring-offset-2 ring-offset-surface focus-visible:ring-2 focus-visible:ring-accent"
      style={{
        width: 200,
        height: 140,
        backgroundColor: "var(--bg)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/place-photo?ref=${encodeURIComponent(ref_)}&size=thumb`}
        alt=""
        className="h-full w-full object-cover transition-[filter,transform] duration-200 group-hover:brightness-110 motion-reduce:group-hover:brightness-100"
        style={{ opacity: state === "loading" ? 0 : 1 }}
        onLoad={() => setState("ok")}
        onError={() => setState("error")}
      />
    </button>
  );
}

export function ReviewCard({ review }: { review: PlaceReview }) {
  return (
    <div
      className="rounded-lg bg-bg p-3"
      style={{ border: "0.5px solid var(--border)" }}
    >
      <div
        className="flex items-center gap-2 text-[12px] text-ink-soft"
        style={{ lineHeight: 1 }}
      >
        <Stars filled={review.rating} />
        <span className="text-ink">{review.author}</span>
        {review.timeDescription && <span>· {review.timeDescription}</span>}
      </div>
      {review.text && (
        <p className="mt-1.5 line-clamp-4 text-[13px] leading-snug text-ink">
          {review.text}
        </p>
      )}
    </div>
  );
}

function Stars({ filled }: { filled: number }) {
  const rounded = Math.max(0, Math.min(5, Math.round(filled)));
  return (
    <span
      aria-label={`${filled.toFixed(1)} of 5`}
      className="inline-flex shrink-0 items-center"
      style={{ gap: 1 }}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon key={i} filled={i < rounded} />
      ))}
    </span>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ display: "block", flex: "none" }}
    >
      <path
        d="M12 2 L14.85 8.62 L22 9.36 L16.5 14.16 L18.18 21.02 L12 17.27 L5.82 21.02 L7.5 14.16 L2 9.36 L9.15 8.62 Z"
        fill={filled ? "var(--accent)" : "transparent"}
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
