"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  // Right-edge alignment relative to the anchor. The popover's right
  // edge lines up with the anchor's right edge — what we want for an
  // avatar in the top-right of the header.
  align?: "start" | "end";
  // Distance below the anchor in px. Default 8.
  offset?: number;
  width?: number;
  children: ReactNode;
}

// Minimal popover: click-outside close, Esc close, focus return, and
// fixed positioning anchored to a button ref. No focus-trap (the
// settings popover holds simple buttons, not a form). If we ever need
// trap/portal/positioning at scale, swap in @radix-ui/react-popover.
export default function Popover({
  open,
  onOpenChange,
  anchorRef,
  align = "end",
  offset = 8,
  width = 360,
  children,
}: Props) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Position synchronously before paint to avoid a flash at (0,0).
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const top = rect.bottom + offset;
    const left =
      align === "end" ? rect.right - width : rect.left;
    setPos({ top, left });
  }, [open, anchorRef, align, offset, width]);

  // Close on Esc and on outside click.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onOpenChange(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, onOpenChange, anchorRef]);

  // Return focus to anchor on close so keyboard users don't get stranded.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (wasOpenRef.current && !open) {
      anchorRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open, anchorRef]);

  if (!open || !pos) return null;

  return (
    <div
      ref={popoverRef}
      role="dialog"
      className="fixed z-50 overflow-y-auto rounded-xl bg-bg p-4 shadow-lg outline-none"
      style={{
        top: pos.top,
        left: pos.left,
        width,
        maxHeight: `calc(100vh - ${pos.top + 16}px)`,
        border: "0.5px solid var(--border)",
      }}
    >
      {children}
    </div>
  );
}
