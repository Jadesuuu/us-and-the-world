"use client";

import { Fragment, useMemo } from "react";

export interface VisitNoteEntry {
  // Optional stable identifier for React keys; falls back to index.
  id?: string;
  note: string;
  // Display name of the visit's creator. Used as the per-note label
  // when 2+ entries are present.
  authorName: string;
  // ISO timestamp; entries are sorted ascending by this so the first
  // person to log on a given day reads first.
  visitedAt: string;
}

interface Props {
  notes: VisitNoteEntry[];
}

// Renders one or more handwritten visit notes for a single day group.
// Single note → no attribution label (one voice doesn't need a name).
// Two or more → each note gets a small uppercase author label and is
// separated from the next by a thin centered divider.
export function VisitNotes({ notes }: Props) {
  const sorted = useMemo(
    () => [...notes].sort((a, b) => a.visitedAt.localeCompare(b.visitedAt)),
    [notes],
  );

  if (sorted.length === 0) return null;
  const showAttribution = sorted.length > 1;

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((entry, i) => (
        <Fragment key={entry.id ?? i}>
          {i > 0 && showAttribution && (
            <hr
              aria-hidden
              className="mx-auto w-2/5 border-0"
              style={{ borderTop: "0.5px solid var(--border)" }}
            />
          )}
          <div>
            {showAttribution && (
              <p
                className="font-body uppercase text-[11px] font-medium text-ink-soft"
                style={{ letterSpacing: "0.06em", marginBottom: 4 }}
              >
                {entry.authorName}
              </p>
            )}
            <p
              className="font-handwritten text-[16px] text-ink"
              style={{
                lineHeight: 1.55,
                transform: "rotate(-1deg)",
                transformOrigin: "left top",
              }}
            >
              {entry.note}
            </p>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
