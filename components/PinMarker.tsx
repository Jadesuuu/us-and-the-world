"use client";

import { AnimatePresence, motion } from "framer-motion";

interface PinMarkerProps {
  fill: string;
  rotation?: number;
  animate?: boolean; // initial drop-in animation for newly-added pins
  size?: number;
  visitDayCount?: number; // 0 = State A, 1 = B, 2+ = C
}

export function rotationFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 7) - 3;
}

const SPRING = { type: "spring" as const, stiffness: 500, damping: 30 };

export default function PinMarker({
  fill,
  rotation = 0,
  animate = false,
  size = 28,
  visitDayCount = 0,
}: PinMarkerProps) {
  const width = size * 0.72;

  const livedOnce = visitDayCount >= 1;
  const livedMultiple = visitDayCount >= 2;

  return (
    <div
      className="relative"
      style={{ width, height: size }}
    >

      {/* Teardrop SVG. Wrapped in the rotation jitter; the drop-in
          animation runs on the wrapper if `animate` is true. */}
      <div
        className={animate ? "pin-drop-in" : "pin-rotate"}
        style={{
          ["--rot" as string]: `${rotation}deg`,
          position: "relative",
          zIndex: 1,
        }}
      >
        <svg
          width={width}
          height={size}
          viewBox="0 0 20 28"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          style={{ display: "block" }}
        >
          <path
            className="pin-marker-shape"
            d="M10 27.5
               C 10 27.5, 0.5 16.7, 0.5 9.7
               C 0.5 4.3, 4.7 0.5, 10 0.5
               C 15.3 0.5, 19.5 4.6, 19.5 9.8
               C 19.5 16.9, 10 27.5, 10 27.5 Z"
            style={{ fill }}
          />
          <circle
            cx="10.2"
            cy="9.7"
            r="2.6"
            style={{ fill: "var(--bg)" }}
            opacity="0.85"
          />
          <AnimatePresence>
            {livedOnce && (
              <motion.circle
                key="dot"
                cx="10.2"
                cy="9.7"
                r="1.4"
                style={{ fill: "var(--bg)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            )}
          </AnimatePresence>
        </svg>
      </div>

      {/* Day-count badge. Outside the rotated wrapper so it stays
          upright at any pin rotation. Counter-rotation isn't needed
          because the wrapper itself isn't rotated. */}
      <AnimatePresence>
        {livedMultiple && (
          <motion.div
            key="badge"
            aria-hidden="true"
            className="absolute"
            style={{
              top: -3,
              right: -5,
              width: 14,
              height: 14,
              borderRadius: "50%",
              backgroundColor: "var(--accent)",
              border: "1.5px solid var(--bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontFamily: "var(--font-body)",
              fontSize: 9,
              fontWeight: 700,
              lineHeight: 1,
              zIndex: 2,
            }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={SPRING}
          >
            {visitDayCount}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
