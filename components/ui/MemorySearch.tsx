"use client";

import { useRef } from "react";
import { Search, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (next: string) => void;
}

// Themed text input for filtering Lived-tab memories by pin title.
// Reads from theme variables (--surface, --border, --ink-soft) so it
// blends with whichever mood the user is in. Caveat italic placeholder
// gives the handwritten "search your memories…" feel.
export function MemorySearch({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div
      className="flex h-11 w-full items-center gap-2 rounded-xl bg-surface px-3"
      style={{ border: "0.5px solid var(--border)" }}
    >
      <Search size={16} className="shrink-0 text-ink-soft" aria-hidden />
      <input
        ref={inputRef}
        type="text"
        aria-label="search memories"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="search your memories…"
        className="memory-search-input flex-1 bg-transparent text-[16px] text-ink outline-none"
      />
      {value.length > 0 && (
        <button
          type="button"
          aria-label="clear search"
          onClick={() => {
            onChange("");
            // Return focus so the user can keep typing without a tap.
            inputRef.current?.focus();
          }}
          className="shrink-0 text-ink-soft"
        >
          <X size={14} aria-hidden />
        </button>
      )}

      <style jsx>{`
        .memory-search-input::placeholder {
          font-family: var(--font-handwritten);
          font-style: italic;
          font-size: 16px;
          color: var(--ink-soft);
        }
      `}</style>
    </div>
  );
}
