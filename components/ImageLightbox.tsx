"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { useIsDesktop } from "@/lib/use-is-desktop";
import type { VisitPhoto } from "@/hooks/usePinVisits";

interface Props {
  photos: VisitPhoto[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

const SWIPE_DOWN_THRESHOLD = 90; // px of vertical drag to dismiss
const SWIPE_DOWN_HORIZONTAL_LIMIT = 60; // ignore if also swiping sideways

function reducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function ImageLightbox({
  photos,
  initialIndex,
  open,
  onClose,
}: Props) {
  const isDesktop = useIsDesktop();
  const reduced = typeof window !== "undefined" && reducedMotion();

  const [emblaRef, emblaApi] = useEmblaCarousel({
    startIndex: initialIndex,
    loop: false,
    // duration is in ms in Embla 8. Reduced motion → instant snap.
    duration: reduced ? 0 : 25,
    // Don't allow Embla to grab gestures when there's only one photo.
    watchDrag: photos.length > 1,
  });

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  // Mobile-only: tap once to toggle the chrome (counter, close, strip).
  const [uiVisible, setUiVisible] = useState(true);

  // Keep activeIndex in sync with Embla's selected snap.
  useEffect(() => {
    if (!emblaApi) return;
    const sync = () => setActiveIndex(emblaApi.selectedScrollSnap());
    sync();
    emblaApi.on("select", sync);
    return () => {
      emblaApi.off("select", sync);
    };
  }, [emblaApi]);

  // Re-anchor + reset chrome when the lightbox is reopened on a new
  // index (e.g., user closed it on photo 4, then taps photo 1 in a
  // different visit's strip).
  useEffect(() => {
    if (!open || !emblaApi) return;
    emblaApi.scrollTo(initialIndex, true);
    setActiveIndex(initialIndex);
    setUiVisible(true);
  }, [open, initialIndex, emblaApi]);

  // Auto-scroll the thumb strip so the active thumb stays in view.
  const stripRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
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
  }, [activeIndex, open, reduced]);

  // Keyboard navigation. We capture at the document level + stop
  // propagation so an Esc press inside a PinDrawer-hosted lightbox
  // closes the lightbox without also closing the underlying drawer.
  useEffect(() => {
    if (!open) return;
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
  }, [open, emblaApi, onClose]);

  // Mobile swipe-down dismiss. Two-finger pinches don't trigger
  // touchstart/touchend in the same single-finger pattern, so this
  // doesn't interfere with pinch-zoom.
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      touchStartRef.current = null;
      return;
    }
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }, []);
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dy = t.clientY - start.y;
      const dx = t.clientX - start.x;
      if (
        dy > SWIPE_DOWN_THRESHOLD &&
        Math.abs(dx) < SWIPE_DOWN_HORIZONTAL_LIMIT
      ) {
        onClose();
      }
    },
    [onClose],
  );

  if (!open) return null;

  const isSingle = photos.length <= 1;
  const canPrev = activeIndex > 0;
  const canNext = activeIndex < photos.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-[70] image-lightbox-fadein"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--bg) 95%, rgba(0, 0, 0, 0.9))",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      {/* Top chrome: counter (left) + close (right). */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4 transition-opacity duration-200 ${
          uiVisible ? "opacity-100" : "opacity-0"
        }`}
        style={{
          paddingTop: "max(env(safe-area-inset-top), 16px)",
        }}
      >
        {!isSingle ? (
          <span
            className="pointer-events-auto rounded-full px-3 py-1 font-body text-[14px] text-ink"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--surface) 80%, transparent)",
              border: "0.5px solid var(--border)",
            }}
          >
            {activeIndex + 1} / {photos.length}
          </span>
        ) : (
          <span aria-hidden />
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full text-ink"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--surface) 80%, transparent)",
            border: "0.5px solid var(--border)",
          }}
        >
          <X size={20} aria-hidden />
        </button>
      </div>

      {/* Carousel viewport. p-4 leaves a sliver of backdrop around the
          slides for desktop "click outside image to dismiss" — the
          outer onClick below catches that case. */}
      <div
        className="absolute inset-0 flex items-center justify-center p-4"
        onClick={(e) => {
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
                  key={p.id}
                  className="flex h-full min-w-0 shrink-0 grow-0 basis-full items-center justify-center"
                  onClick={(e) => {
                    if (isDesktop) {
                      // Click on the slide (but not on the image
                      // itself, which stops propagation) dismisses.
                      onClose();
                    } else {
                      // Mobile: toggle the chrome on/off.
                      setUiVisible((v) => !v);
                      e.stopPropagation();
                    }
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image_url}
                    alt=""
                    className="max-h-full max-w-full select-none object-contain"
                    style={{
                      // Pinch-zoom is allowed on the image even if any
                      // ancestor sets touch-action: none in the future.
                      touchAction: "pinch-zoom",
                      // Desktop-only max width so the image doesn't
                      // bleed into the would-be backdrop strip.
                      maxWidth: isDesktop ? "95vw" : "100vw",
                      maxHeight: isDesktop ? "75vh" : "85vh",
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

      {/* Desktop arrow buttons. Hidden on mobile — gestures handle nav. */}
      {!isSingle && isDesktop && (
        <>
          <button
            type="button"
            onClick={() => emblaApi?.scrollPrev()}
            disabled={!canPrev}
            aria-label="previous photo"
            className="absolute left-4 top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full text-ink transition-opacity hover:!opacity-100"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--surface) 70%, transparent)",
              border: "0.5px solid var(--border)",
              opacity: canPrev ? 0.7 : 0.25,
            }}
          >
            <ChevronLeft size={32} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => emblaApi?.scrollNext()}
            disabled={!canNext}
            aria-label="next photo"
            className="absolute right-4 top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full text-ink transition-opacity hover:!opacity-100"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--surface) 70%, transparent)",
              border: "0.5px solid var(--border)",
              opacity: canNext ? 0.7 : 0.25,
            }}
          >
            <ChevronRight size={32} aria-hidden />
          </button>
        </>
      )}

      {/* Bottom thumbnail strip. */}
      {!isSingle && (
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 transition-opacity duration-200 ${
            uiVisible ? "opacity-100" : "opacity-0"
          }`}
          style={{
            paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
          }}
        >
          <div
            ref={stripRef}
            className="pointer-events-auto flex justify-start gap-2 overflow-x-auto px-4 py-3 sm:justify-center"
          >
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                data-thumb-index={i}
                onClick={() => emblaApi?.scrollTo(i)}
                aria-label={`go to photo ${i + 1}`}
                aria-current={i === activeIndex ? "true" : undefined}
                className="h-16 w-16 shrink-0 overflow-hidden rounded-lg"
                style={{
                  border:
                    i === activeIndex
                      ? "2px solid var(--accent)"
                      : "0.5px solid var(--border)",
                  opacity: i === activeIndex ? 1 : 0.55,
                  transition: "opacity 150ms",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image_url}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
