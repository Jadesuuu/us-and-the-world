"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { optimizedUrl } from "@/lib/image-url";

// Source-agnostic photo shape so the lightbox can host visit photos
// (Cloudinary), Google Places previews, or anything else without
// learning about each upstream schema.
export type LightboxPhoto = {
  url: string;
  thumbnailUrl?: string;
  alt?: string;
  attribution?: string;
};

interface Props {
  photos: LightboxPhoto[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

// Swipe-down dismiss thresholds. Distance OR velocity will fire — a
// short fast flick and a long slow drag both feel like "I'm done."
const SWIPE_DISMISS_DISTANCE = 100;
const SWIPE_DISMISS_VELOCITY = 0.5; // px / ms
const SWIPE_DIRECTION_LOCK_PX = 12; // movement before we lock H or V
const SWIPE_DIRECTION_RATIO = 1.5; // |dy| > |dx| * 1.5 → vertical

function reducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Cloudinary delivery with auto format/quality and a 2000px width cap.
// Shared with the thumbnail helpers in lib/image-url.ts.
const optimizeUrl = optimizedUrl;

export default function ImageLightbox({
  photos,
  initialIndex,
  open,
  onClose,
}: Props) {
  const isDesktop = useIsDesktop();
  const reduced = typeof window !== "undefined" && reducedMotion();

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        {/* Pure black overlay — no theme tint, no blur. The photo is
            the content; the canvas behind it should disappear. */}
        <Dialog.Overlay
          className="fixed inset-0 z-[70]"
          style={{ backgroundColor: "#000000" }}
        />
        <Dialog.Content
          className="fixed inset-0 z-[70] flex flex-col outline-none"
          // Radix's default outside-pointer + escape both call onClose
          // via onOpenChange — we don't intercept those here. The
          // photo's own click handlers are scoped per element below.
        >
          {/* Title + Description are required by Radix's a11y check.
              VisuallyHidden keeps them screen-reader-only without an
              `sr-only` Tailwind dependency. */}
          <VisuallyHidden.Root>
            <Dialog.Title>Photo viewer</Dialog.Title>
            <Dialog.Description>
              Use the arrow keys or buttons to navigate between photos.
              Press Escape to close.
            </Dialog.Description>
          </VisuallyHidden.Root>
          {open && (
            <LightboxBody
              photos={photos}
              initialIndex={initialIndex}
              onClose={onClose}
              isDesktop={isDesktop}
              reduced={reduced}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface BodyProps {
  photos: LightboxPhoto[];
  initialIndex: number;
  onClose: () => void;
  isDesktop: boolean;
  reduced: boolean;
}

function LightboxBody({
  photos,
  initialIndex,
  onClose,
  isDesktop,
  reduced,
}: BodyProps) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  // Mobile-only: tap the photo to fade chrome out, tap again to bring back.
  const [chromeVisible, setChromeVisible] = useState(true);
  // Drive vertical-drag visual feedback. Live during a downward drag,
  // resets on release (or animates to dismissed state on threshold hit).
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    startIndex: initialIndex,
    loop: false,
    duration: reduced ? 0 : 25,
    watchDrag: photos.length > 1,
  });

  // Sync active index with Embla.
  useEffect(() => {
    if (!emblaApi) return;
    const sync = () => setActiveIndex(emblaApi.selectedScrollSnap());
    sync();
    emblaApi.on("select", sync);
    return () => {
      emblaApi.off("select", sync);
    };
  }, [emblaApi]);

  // When the lightbox reopens, anchor at initialIndex and reset chrome.
  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.scrollTo(initialIndex, true);
    setActiveIndex(initialIndex);
    setChromeVisible(true);
  }, [initialIndex, emblaApi]);

  // Auto-scroll thumbnail strip to keep the active thumb visible.
  const stripRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const active = strip.querySelector<HTMLElement>(
      `[data-thumb-index="${activeIndex}"]`,
    );
    active?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [activeIndex, reduced]);

  // Keyboard nav. Captured at document level so an Esc keypress in a
  // PinDrawer-hosted lightbox closes only the lightbox, not the drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        emblaApi?.scrollPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        emblaApi?.scrollNext();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [emblaApi, onClose]);

  // ----------------------------------------------------------
  // Mobile vertical-drag dismiss with visual feedback
  // ----------------------------------------------------------
  // Strategy: track touchstart, then on touchmove decide once if the
  // gesture is vertical (|dy| > |dx| * 1.5 after ~12px). If vertical,
  // we apply translateY + backdrop fade live. If horizontal, we don't
  // touch transform — Embla handles the swipe naturally.
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    locked: "horizontal" | "vertical" | null;
  } | null>(null);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isDesktop) return;
      if (e.touches.length !== 1) {
        dragRef.current = null;
        return;
      }
      const t = e.touches[0];
      dragRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        startTime: performance.now(),
        locked: null,
      };
      setIsDragging(true);
    },
    [isDesktop],
  );

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const state = dragRef.current;
    if (!state) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - state.startX;
    const dy = t.clientY - state.startY;

    if (state.locked === null) {
      if (
        Math.abs(dx) > SWIPE_DIRECTION_LOCK_PX ||
        Math.abs(dy) > SWIPE_DIRECTION_LOCK_PX
      ) {
        state.locked =
          Math.abs(dy) > Math.abs(dx) * SWIPE_DIRECTION_RATIO && dy > 0
            ? "vertical"
            : "horizontal";
      }
    }

    if (state.locked === "vertical" && dy > 0) {
      setDragY(dy);
    }
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const state = dragRef.current;
      dragRef.current = null;
      setIsDragging(false);
      if (!state) return;
      const t = e.changedTouches[0];
      if (!t) {
        setDragY(0);
        return;
      }
      const dy = t.clientY - state.startY;
      const dt = performance.now() - state.startTime;
      const velocity = dy / Math.max(dt, 1);

      const shouldDismiss =
        state.locked === "vertical" &&
        (dy > SWIPE_DISMISS_DISTANCE && velocity > SWIPE_DISMISS_VELOCITY);

      if (shouldDismiss) {
        // Fall through with dragY held — backdrop is already faded
        // and the photo is offset; closing now feels continuous.
        onClose();
        // Reset for next open (next time the body mounts dragY is
        // already 0, but if the same body somehow re-renders before
        // unmount we want a clean slate).
        setDragY(0);
      } else {
        setDragY(0);
      }
    },
    [onClose],
  );

  if (photos.length === 0) return null;

  const isSingle = photos.length <= 1;
  const canPrev = activeIndex > 0;
  const canNext = activeIndex < photos.length - 1;
  const dragProgress = Math.min(1, dragY / 400);
  const backdropOpacity = reduced ? 1 : 1 - dragProgress * 0.7;

  return (
    <>
      {/* Live backdrop tint over Dialog.Overlay's solid black so the
          fade-during-drag effect is visible without changing the
          actual overlay element. */}
      <div
        className="pointer-events-none fixed inset-0 z-[70]"
        style={{
          backgroundColor: "#000000",
          opacity: backdropOpacity,
          transition: isDragging
            ? "none"
            : reduced
              ? "none"
              : "opacity 250ms ease-out",
        }}
      />

      {/* Top bar: counter (left) + close (right). Gradient ground so
          chrome reads against bright photos. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[71]"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 8px)",
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 100%)",
          opacity: chromeVisible ? 1 : 0,
          transition: reduced ? "none" : "opacity 200ms ease-out",
        }}
      >
        <div className="flex h-11 items-center justify-between px-3">
          {!isSingle ? (
            <span
              className="pointer-events-auto px-2 font-body text-[14px] font-medium text-white"
              style={{
                textShadow: "0 1px 2px rgba(0,0,0,0.5)",
              }}
            >
              {activeIndex + 1} / {photos.length}
            </span>
          ) : (
            <span aria-hidden />
          )}
          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="Close"
              className="pointer-events-auto flex h-11 w-11 items-center justify-center text-white"
            >
              <X size={24} aria-hidden />
            </button>
          </Dialog.Close>
        </div>
      </div>

      {/* Carousel viewport. The whole region is touch-handled for
          vertical swipe-dismiss; Embla owns horizontal. */}
      <div
        className="absolute inset-0 z-[70] flex flex-col"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: dragY > 0 && !reduced ? `translateY(${dragY}px)` : "none",
          transition: isDragging
            ? "none"
            : reduced
              ? "none"
              : "transform 250ms ease-out",
        }}
        onClick={(e) => {
          // Desktop: clicking outside the photo dismisses. Mobile: the
          // slide-level handler below toggles chrome instead.
          if (isDesktop && e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={emblaRef}
          className="h-full w-full overflow-hidden"
          style={{ touchAction: "pan-y pinch-zoom" }}
        >
          <div className="flex h-full">
            {photos.map((p, i) => {
              const adjacent = Math.abs(i - activeIndex) <= 1;
              return (
                <div
                  key={p.url}
                  className="flex h-full min-w-0 shrink-0 grow-0 basis-full items-center justify-center"
                  onClick={(e) => {
                    if (isDesktop) {
                      // Click on the slide background (not the photo
                      // itself, which stops propagation) dismisses.
                      onClose();
                    } else {
                      setChromeVisible((v) => !v);
                      e.stopPropagation();
                    }
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={optimizeUrl(p.url)}
                    alt={p.alt ?? ""}
                    className="max-h-full max-w-full select-none object-contain"
                    style={{
                      // Pinch-zoom passes through to the browser. Native
                      // viewport pinch-zoom works as a fallback.
                      // TODO: in-app 1×–4× pinch via @use-gesture/react
                      // when we want to disable Embla during zoom and
                      // double-tap-to-zoom-on-tap-point.
                      touchAction: "pinch-zoom",
                    }}
                    loading={adjacent ? "eager" : "lazy"}
                    draggable={false}
                    onClick={(e) => {
                      if (isDesktop) e.stopPropagation();
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Desktop arrow buttons. Mobile uses gestures. */}
      {!isSingle && isDesktop && (
        <>
          <button
            type="button"
            onClick={() => emblaApi?.scrollPrev()}
            disabled={!canPrev}
            aria-label="previous photo"
            className="absolute left-4 top-1/2 z-[71] flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full text-white transition-opacity hover:!opacity-100"
            style={{
              backgroundColor: "rgba(255,255,255,0.10)",
              opacity: canPrev ? 0.7 : 0.4,
            }}
          >
            <ChevronLeft size={32} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => emblaApi?.scrollNext()}
            disabled={!canNext}
            aria-label="next photo"
            className="absolute right-4 top-1/2 z-[71] flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full text-white transition-opacity hover:!opacity-100"
            style={{
              backgroundColor: "rgba(255,255,255,0.10)",
              opacity: canNext ? 0.7 : 0.4,
            }}
          >
            <ChevronRight size={32} aria-hidden />
          </button>
        </>
      )}

      {/* Attribution caption (e.g., "Photo by Carlos E.") — rendered
          above the strip so it sits over the bottom gradient and
          fades in/out with the rest of the chrome on mobile.
          Single-photo case still gets attribution if present. */}
      {photos[activeIndex]?.attribution && (
        <div
          className="pointer-events-none absolute inset-x-0 z-[72] flex justify-center px-6"
          style={{
            bottom: isSingle
              ? "calc(max(env(safe-area-inset-bottom), 0px) + 16px)"
              : "calc(max(env(safe-area-inset-bottom), 0px) + 96px)",
            opacity: chromeVisible ? 0.7 : 0,
            transition: reduced ? "none" : "opacity 200ms ease-out",
          }}
        >
          <span
            className="max-w-[80%] truncate font-body text-[12px] italic text-white"
            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}
          >
            {photos[activeIndex].attribution}
          </span>
        </div>
      )}

      {/* Bottom thumbnail strip. */}
      {!isSingle && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[71]"
          style={{
            paddingBottom: "max(env(safe-area-inset-bottom), 0px)",
            background:
              "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 100%)",
            opacity: chromeVisible ? 1 : 0,
            transition: reduced ? "none" : "opacity 200ms ease-out",
          }}
        >
          <div
            ref={stripRef}
            className="pointer-events-auto flex justify-start gap-2 overflow-x-auto px-3 py-3 sm:justify-center"
          >
            {photos.map((p, i) => (
              <button
                key={p.url}
                type="button"
                data-thumb-index={i}
                onClick={() => emblaApi?.scrollTo(i)}
                aria-label={`go to photo ${i + 1}`}
                aria-current={i === activeIndex ? "true" : undefined}
                className="h-16 w-16 shrink-0 overflow-hidden rounded-lg"
                style={{
                  border:
                    i === activeIndex
                      ? "2px solid #FFFFFF"
                      : "0.5px solid rgba(255,255,255,0.20)",
                  opacity: i === activeIndex ? 1 : 0.55,
                  transition: reduced ? "none" : "opacity 150ms",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={optimizeUrl(p.thumbnailUrl ?? p.url)}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
