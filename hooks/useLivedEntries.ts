"use client";

import { useMemo } from "react";
import { useAllVisits, type VisitWithPin } from "./useAllVisits";

// One Lived-tab entry = one (pin, calendar-day) bucket.
//
// Mirrors the day-grouping logic in PinDrawer's timeline so the
// ordinal a user sees on a Lived card matches what they'd see in the
// drawer for the same visit. Two visits to the same pin on the same
// day collapse into ONE entry whose `visits` array holds them both.
export interface LivedEntry {
  // Stable React key. `${pinId}|${day}` is unique per row.
  key: string;
  pinId: string;
  pinTitle: string;
  // YYYY-MM-DD in user's local timezone.
  day: string;
  // ISO timestamp of the earliest visit in the group — used as sort
  // anchor and as the input to formatLongDate for display.
  visitedAt: string;
  visits: VisitWithPin[];
  // 1-based rank of this day among the pin's distinct visited days.
  // Two same-day visits share ordinal 1.
  ordinal: number;
}

function localCalendarDay(iso: string): string {
  // en-CA gives YYYY-MM-DD format. Same convention as PinDrawer's
  // groupVisitsByDate, so day boundaries align across the app.
  return new Date(iso).toLocaleDateString("en-CA");
}

export function buildLivedEntries(visits: VisitWithPin[]): LivedEntry[] {
  // 1. Bucket visits into (pin, day) groups.
  const groups = new Map<string, LivedEntry>();
  for (const v of visits) {
    if (!v.pin) continue; // orphaned visit (pin deleted) — skip
    const day = localCalendarDay(v.visited_at);
    const key = `${v.pin_id}|${day}`;
    let entry = groups.get(key);
    if (!entry) {
      entry = {
        key,
        pinId: v.pin_id,
        pinTitle: v.pin.title,
        day,
        visitedAt: v.visited_at,
        visits: [],
        ordinal: 0,
      };
      groups.set(key, entry);
    }
    entry.visits.push(v);
    if (v.visited_at < entry.visitedAt) {
      entry.visitedAt = v.visited_at;
    }
  }

  // 2. Per pin, rank distinct days ascending → ordinal.
  const byPin = new Map<string, LivedEntry[]>();
  for (const entry of groups.values()) {
    const list = byPin.get(entry.pinId) ?? [];
    list.push(entry);
    byPin.set(entry.pinId, list);
  }
  for (const list of byPin.values()) {
    list.sort((a, b) => a.day.localeCompare(b.day));
    list.forEach((e, i) => {
      e.ordinal = i + 1;
    });
  }

  // 3. Final order: newest day first, matching mobile/desktop UX
  // expectations (most recent memory at the top of the list).
  return [...groups.values()].sort((a, b) =>
    b.visitedAt.localeCompare(a.visitedAt),
  );
}

export function useLivedEntries() {
  const query = useAllVisits();
  const entries = useMemo(
    () => buildLivedEntries(query.data ?? []),
    [query.data],
  );
  return { ...query, entries };
}
