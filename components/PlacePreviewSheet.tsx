"use client";

import { Drawer } from "vaul";
import { useState } from "react";
import type { PlaceReview, ResolvedPlace } from "./SearchControl";

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
              titleAs="drawer"
            />
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

// Reusable for the desktop sidebar. titleAs="drawer" uses Drawer.Title
// (only valid inside a Vaul drawer); titleAs="panel" uses a plain <h2>.
export function PreviewBody({
  place,
  onDropDream,
  titleAs,
}: {
  place: ResolvedPlace;
  onDropDream: () => void;
  titleAs: "drawer" | "panel";
}) {
  return (
    <div
      className="flex flex-col overflow-y-auto"
      style={{ overscrollBehavior: "contain" }}
    >
      {/* Sticky photos — pinned to the top of the scroll container so a
          long review list never pushes them off-screen. */}
      {place.photoRefs.length > 0 && (
        <div className="sticky top-0 z-10 bg-surface px-5 pb-2 pt-3">
          <div className="flex gap-2 overflow-x-auto">
            {place.photoRefs.map((ref) => (
              <PreviewPhoto key={ref} ref_={ref} />
            ))}
          </div>
        </div>
      )}

      {/* Header — scrolls with content. */}
      <div className="px-5 pt-3">
        {titleAs === "drawer" ? (
          <Drawer.Title className="font-display italic text-[22px] leading-tight text-ink">
            {place.name}
          </Drawer.Title>
        ) : (
          <h2 className="font-display italic text-[22px] leading-tight text-ink">
            {place.name}
          </h2>
        )}
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
      </div>

      {/* Reviews — scroll naturally with the body. */}
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

      {/* Sticky footer — primary action stays anchored regardless of
          scroll position. */}
      <div
        className="sticky bottom-0 z-10 bg-surface px-5 pt-4 pb-[max(env(safe-area-inset-bottom),1.25rem)]"
        style={{ marginTop: 16 }}
      >
        <button
          type="button"
          onClick={onDropDream}
          className="h-12 w-full rounded-lg bg-accent font-display italic text-[16px] text-bg"
        >
          drop a dream here
        </button>
      </div>
    </div>
  );
}

function PreviewPhoto({ ref_ }: { ref_: string }) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  if (state === "error") return null;
  return (
    <div
      className="shrink-0 overflow-hidden rounded-lg"
      style={{
        width: 200,
        height: 140,
        backgroundColor: "var(--bg)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/place-photo?ref=${encodeURIComponent(ref_)}`}
        alt=""
        className="h-full w-full object-cover"
        style={{ opacity: state === "loading" ? 0 : 1 }}
        onLoad={() => setState("ok")}
        onError={() => setState("error")}
      />
    </div>
  );
}

function ReviewCard({ review }: { review: PlaceReview }) {
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
