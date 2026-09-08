"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { DEMO_BACK_URL, IS_DEMO } from "@/lib/demo";

// Read-only demo disclaimer. A small pill sits at the top centre of the
// viewport (the search bar normally lives there and is hidden in demo
// mode). Tapping it expands a card that spells out which features are
// switched off. Renders nothing outside demo builds.
export default function DemoBanner() {
  if (!IS_DEMO) return null;
  return <DemoBannerInner />;
}

function DemoBannerInner() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="demo-banner-details"
        className="fixed left-1/2 z-30 flex h-10 -translate-x-1/2 items-center gap-2 rounded-full bg-surface px-4 text-ink shadow-md top-[max(env(safe-area-inset-top),1rem)] lg:top-[10px]"
        style={{ border: "1px solid var(--border)" }}
      >
        <span
          aria-hidden
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: "var(--accent)" }}
        />
        <span className="font-display italic text-[15px] leading-none">
          Demo
        </span>
        <span className="text-[13px] leading-none text-ink-soft">
          read-only snapshot
        </span>
      </button>

      {open && (
        <div
          id="demo-banner-details"
          role="dialog"
          aria-label="About this demo"
          className="fixed left-1/2 z-30 w-[min(92vw,380px)] -translate-x-1/2 rounded-2xl bg-surface p-5 text-ink shadow-lg top-[calc(max(env(safe-area-inset-top),1rem)+3rem)] lg:top-[58px]"
          style={{ border: "1px solid var(--border)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display italic text-[20px] leading-tight">
              This is a demo
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-ink-soft"
            >
              <X size={16} />
            </button>
          </div>
          <p className="mt-2 text-[14px] leading-snug text-ink-soft">
            JF &amp; The World is a private map journal for two people. What
            you&apos;re browsing is a curated snapshot of real pins and
            memories, frozen in time.
          </p>
          <p className="mt-3 text-[14px] leading-snug text-ink-soft">
            To keep the demo free to host and safe to share, these features
            are switched off here:
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-[14px] text-ink">
            <li>· Searching for places</li>
            <li>· Dropping new dreams</li>
            <li>· Logging visits and uploading photos</li>
            <li>· Realtime sync and push notifications between partners</li>
          </ul>
          <p className="mt-3 font-handwritten text-[17px] text-ink">
            Everything else is the real thing. Spin the globe.
          </p>
          {DEMO_BACK_URL && (
            <a
              href={DEMO_BACK_URL}
              className="mt-4 flex h-10 items-center justify-center rounded-lg bg-accent font-display italic text-[16px] text-bg"
            >
              Back to the case study
            </a>
          )}
        </div>
      )}
    </>
  );
}
