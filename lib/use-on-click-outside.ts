"use client";

import { useEffect, type RefObject } from "react";

// Fires `handler` when a pointerdown lands outside `ref`. We listen on
// pointerdown rather than click so the dropdown closes the moment the
// user starts interacting elsewhere — feels snappier than waiting for
// the click to release.
export function useOnClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  handler: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;
    const listener = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (ref.current?.contains(target)) return;
      handler();
    };
    document.addEventListener("pointerdown", listener);
    return () => document.removeEventListener("pointerdown", listener);
  }, [ref, handler, enabled]);
}
