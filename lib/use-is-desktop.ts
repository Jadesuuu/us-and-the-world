"use client";

import { useEffect, useState } from "react";

// Tailwind's `lg` breakpoint. Matches our SSR-default of mobile — the
// hook returns false until mount, then reflects the live media query.
const QUERY = "(min-width: 1024px)";

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return isDesktop;
}
