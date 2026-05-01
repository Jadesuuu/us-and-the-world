"use client";

import { useEffect, useRef, useState } from "react";

// Reports whether the scroll container is scrolled (top sentinel out
// of view) or has more content below the fold (bottom sentinel out
// of view). Place the returned refs as 1px sentinels at the very top
// and very bottom of your scrollable content; read the booleans to
// drive header/footer drop shadows.
//
// Pure CSS approaches (sticky pseudo-elements with scroll-driven
// gradients) work but break when the scroll container has
// background-color set, which our themed sidebars do.
//   IntersectionObserver is one tiny effect and survives every theme.
export function useScrollShadows() {
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const [topShadow, setTopShadow] = useState(false);
  const [bottomShadow, setBottomShadow] = useState(false);

  useEffect(() => {
    const top = topSentinelRef.current;
    const bottom = bottomSentinelRef.current;
    if (!top || !bottom) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === top) setTopShadow(!entry.isIntersecting);
          if (entry.target === bottom)
            setBottomShadow(!entry.isIntersecting);
        }
      },
      { threshold: 0 },
    );
    observer.observe(top);
    observer.observe(bottom);
    return () => observer.disconnect();
  }, []);

  return { topSentinelRef, bottomSentinelRef, topShadow, bottomShadow };
}

// Inline-style helper so every panel uses the same shadow.
export const SCROLL_SHADOW_TOP = "0 8px 16px -8px rgba(0, 0, 0, 0.18)";
export const SCROLL_SHADOW_BOTTOM = "0 -8px 16px -8px rgba(0, 0, 0, 0.18)";
