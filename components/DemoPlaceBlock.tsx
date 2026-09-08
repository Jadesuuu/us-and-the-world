"use client";

import type { LightboxPhoto } from "./ImageLightbox";
import { DEMO_PLACE_PHOTOS } from "@/lib/demo-data";

// Demo-mode stand-in for PrelivedPlaceBlock. The real app shows Google
// Places photos for a pin until the couple logs their first visit; the
// demo can't call Google, so it shows bundled Wikimedia Commons photos
// instead. Same layout as the Google strip so the drawer reads the same.
// Credits travel with each photo and render inside the lightbox.
export default function DemoPlaceBlock({
  pinId,
  onOpenPhotos,
}: {
  pinId: string;
  onOpenPhotos: (photos: LightboxPhoto[], index: number) => void;
}) {
  const photos = DEMO_PLACE_PHOTOS[pinId];
  if (!photos || photos.length === 0) return null;

  return (
    <div className="mt-6 flex flex-col gap-3">
      <h3 className="font-display italic text-[14px] text-ink-soft">
        From the world
      </h3>
      <div className="-mx-6 flex gap-2 overflow-x-auto px-6">
        {photos.map((p, i) => (
          <button
            key={p.url}
            type="button"
            onClick={() => onOpenPhotos(photos, i)}
            aria-label="View photo"
            className="group shrink-0 overflow-hidden rounded-lg outline-none ring-offset-2 ring-offset-surface focus-visible:ring-2 focus-visible:ring-accent"
            style={{ width: 200, height: 140, backgroundColor: "var(--bg)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.thumbnailUrl ?? p.url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-[filter,transform] duration-200 group-hover:brightness-110 motion-reduce:group-hover:brightness-100"
            />
          </button>
        ))}
      </div>
      <p className="text-[11px] text-ink-soft">
        Photos via Wikimedia Commons. Credits in the viewer.
      </p>
    </div>
  );
}
