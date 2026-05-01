"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Search, X, Loader2 } from "lucide-react";
import { loadPlaces } from "@/lib/google-maps-loader";
import { useOnClickOutside } from "@/lib/use-on-click-outside";

export interface PlaceReview {
  author: string;
  rating: number;
  text: string;
  timeDescription: string;
}

export interface ResolvedPlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  userRatingCount: number | null;
  photoRefs: string[];
  reviews: PlaceReview[];
}

interface Suggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

interface Props {
  onPick: (place: ResolvedPlace) => void;
  onFocusChange?: (focused: boolean) => void;
  // "floating" = mobile, fixed-positioned over the map.
  // "inline"   = desktop, sized to its parent flex slot in DesktopHeader.
  variant?: "floating" | "inline";
}

export default function SearchControl({
  onPick,
  onFocusChange,
  variant = "floating",
}: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingScript, setLoadingScript] = useState(false);
  const [picking, setPicking] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    onFocusChange?.(focused);
  }, [focused, onFocusChange]);

  const placesLibRef = useRef<google.maps.PlacesLibrary | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(
    null,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Outside-click + Escape collapse the dropdown. The blur-with-timeout
  // dance the input used to do is gone — these handlers cover all the
  // dismissal paths cleanly.
  const collapse = useCallback(() => {
    setFocused(false);
    inputRef.current?.blur();
  }, []);
  useOnClickOutside(containerRef, collapse, focused);
  useEffect(() => {
    if (!focused) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") collapse();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focused, collapse]);

  const ensurePlaces = useCallback(async () => {
    if (placesLibRef.current) return placesLibRef.current;
    setLoadingScript(true);
    try {
      const lib = await loadPlaces();
      placesLibRef.current = lib;
      sessionTokenRef.current = new lib.AutocompleteSessionToken();
      return lib;
    } finally {
      setLoadingScript(false);
    }
  }, []);

  // Preload the Places library in the background on mount. Cheap script
  // download, no API calls billed until the user actually queries.
  useEffect(() => {
    void ensurePlaces();
  }, [ensurePlaces]);

  // Debounced prediction fetch — 200ms feels right for typing cadence.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || !placesLibRef.current) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const lib = placesLibRef.current!;
      try {
        const { suggestions: results } =
          await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: query.trim(),
            sessionToken: sessionTokenRef.current ?? undefined,
          });
        setSuggestions(
          results
            .filter((s) => s.placePrediction != null)
            .map((s) => {
              const pp = s.placePrediction!;
              return {
                placeId: pp.placeId,
                mainText: pp.mainText?.toString() ?? pp.text?.toString() ?? "",
                secondaryText: pp.secondaryText?.toString() ?? "",
              };
            }),
        );
      } catch {
        setSuggestions([]);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function extractPhotoRef(photo: google.maps.places.Photo): string | null {
    const directName = (photo as unknown as { name?: string }).name;
    if (typeof directName === "string" && directName.length > 0) {
      return directName.startsWith("places/") ? directName : null;
    }
    try {
      const uri = photo.getURI({ maxWidth: 400 });
      const m = uri.match(/places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+/);
      return m?.[0] ?? null;
    } catch {
      return null;
    }
  }

  async function handleSelect(suggestion: Suggestion) {
    const lib = placesLibRef.current;
    if (!lib) return;
    setPicking(true);
    try {
      const place = new lib.Place({
        id: suggestion.placeId,
        requestedLanguage: "en",
      });
      await place.fetchFields({
        fields: [
          "displayName",
          "formattedAddress",
          "location",
          "photos",
          "reviews",
          "rating",
          "userRatingCount",
        ],
      });

      const lat =
        typeof place.location?.lat === "function" ? place.location.lat() : 0;
      const lng =
        typeof place.location?.lng === "function" ? place.location.lng() : 0;

      const photoRefs = (place.photos ?? [])
        .map(extractPhotoRef)
        .filter((r): r is string => r != null);

      const reviews: PlaceReview[] = (place.reviews ?? [])
        .slice(0, 5)
        .map((r) => ({
          author: r.authorAttribution?.displayName ?? "Anonymous",
          rating: r.rating ?? 0,
          text: r.text ?? "",
          timeDescription: r.relativePublishTimeDescription ?? "",
        }));

      onPick({
        name: place.displayName ?? suggestion.mainText,
        address: place.formattedAddress ?? suggestion.secondaryText,
        lat,
        lng,
        rating: typeof place.rating === "number" ? place.rating : null,
        userRatingCount:
          typeof place.userRatingCount === "number"
            ? place.userRatingCount
            : null,
        photoRefs,
        reviews,
      });

      // Fresh session token for the next search.
      sessionTokenRef.current = new lib.AutocompleteSessionToken();
      setQuery("");
      setSuggestions([]);
      inputRef.current?.blur();
    } catch {
      /* swallow — the user can retry */
    } finally {
      setPicking(false);
    }
  }

  const showDropdown = focused && (query.length > 0 || suggestions.length > 0);

  // Floating: anchored to the top-left edge of the viewport, with right
  // margin reserved for the settings button (~64px), capped at 480px.
  // Inline: fills its parent slot so the desktop header can center it.
  const containerStyle = useMemo<React.CSSProperties>(
    () =>
      variant === "floating"
        ? {
            position: "fixed",
            top: "max(env(safe-area-inset-top, 0px) + 8px, 16px)",
            left: 16,
            right: 64,
            maxWidth: 480,
            // Below the Drawer.Overlay (z-30) so an open drawer
            // visibly covers the search bar — matches the rest of
            // the mobile floating chrome.
            zIndex: 20,
          }
        : {
            // Stacking context so the dropdown paints over the map/sidebar
            // rendered below the header in DOM order. Without this, the
            // suggestions list slips under the map row.
            position: "relative",
            width: "100%",
            maxWidth: 480,
            zIndex: 30,
          },
    [variant],
  );

  return (
    <div ref={containerRef} style={containerStyle}>
      <div className="relative">
        <div
          className="flex items-center gap-2 rounded-xl bg-surface px-4 shadow-sm"
          style={{ border: "0.5px solid var(--border)", height: 44 }}
        >
          <Search
            size={16}
            className="shrink-0 text-ink-soft"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="find somewhere to dream of..."
            className="placeholder-fraunces flex-1 bg-transparent text-[16px] text-ink outline-none"
            style={{ fontFamily: "var(--font-body)" }}
          />
          {(loadingScript || picking) && (
            <Loader2
              size={14}
              className="shrink-0 animate-spin text-ink-soft"
            />
          )}
          {query.length > 0 && !loadingScript && !picking && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSuggestions([]);
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="shrink-0 text-ink-soft"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {showDropdown && (
          <ul
            role="listbox"
            className="absolute inset-x-0 mt-1 overflow-hidden rounded-xl bg-surface"
            style={{
              border: "0.5px solid var(--border)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          >
            {suggestions.length === 0 && !loadingScript && query.length > 0 && (
              <li className="px-4 py-3 text-sm text-ink-soft">
                no places found
              </li>
            )}
            {suggestions.map((s) => (
              <li key={s.placeId} role="option">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault(); // keep input focused
                    handleSelect(s);
                  }}
                  className="flex w-full flex-col items-start px-4 py-3 text-left hover:bg-bg"
                >
                  <span className="text-[15px] text-ink">{s.mainText}</span>
                  {s.secondaryText && (
                    <span className="text-[12px] text-ink-soft">
                      {s.secondaryText}
                    </span>
                  )}
                </button>
              </li>
            ))}
            {/* Required Google attribution for Places data */}
            <li
              className="px-4 py-1 text-right text-[10px] text-ink-soft"
              style={{ borderTop: "0.5px solid var(--border)" }}
            >
              powered by Google
            </li>
          </ul>
        )}
      </div>

      <style jsx>{`
        .placeholder-fraunces::placeholder {
          font-family: var(--font-display);
          font-style: italic;
          font-size: 16px;
          color: var(--ink-soft);
        }
      `}</style>
    </div>
  );
}
