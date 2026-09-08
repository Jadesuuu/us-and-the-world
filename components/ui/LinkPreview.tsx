"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Globe } from "lucide-react";
import { useMemo } from "react";
import { IS_DEMO } from "@/lib/demo";

interface LinkPreviewData {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string;
  url: string;
}

interface Props {
  url: string;
}

// Inspiration-link card. Fetches Open-Graph metadata via the
// authenticated /api/link-preview proxy (the browser can't reach
// most third-party HTML thanks to CORS), then renders a 80×80
// thumbnail + site label + title + description chip.
//
// The component degrades gracefully through three states:
//   1. loading  → subtle pulsing skeleton at the same dimensions
//   2. fallback → domain-only chip when OG returned nothing useful
//                 (Instagram login walls, IP-blocked YouTube embeds,
//                 etc. all land here without scaring the user)
//   3. loaded   → the full preview card
//
// All three open the URL in a new tab on tap. The card is never the
// authoritative store of metadata — Supabase only holds the URL — so
// stale OG data fixes itself on the next 24h-cache miss.
export default function LinkPreview({ url }: Props) {
  const { data, isLoading } = useQuery<LinkPreviewData>({
    queryKey: ["link-preview", url],
    // The OG proxy is auth-gated and there is no session in demo mode, so
    // skip the fetch and fall straight through to the domain chip.
    enabled: !IS_DEMO,
    queryFn: async () => {
      const res = await fetch(
        `/api/link-preview?url=${encodeURIComponent(url)}`,
      );
      if (!res.ok) throw new Error("link preview failed");
      return res.json();
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });

  const hostname = useMemo(() => safeHostname(url), [url]);

  if (isLoading) return <Skeleton />;

  // Treat "no title AND no image" as a fallback — even a successful
  // fetch that gave us only a site name isn't worth a full card.
  const hasUsefulData = !!(data?.title || data?.image);
  if (!data || !hasUsefulData) {
    return <FallbackChip url={url} hostname={data?.siteName ?? hostname} />;
  }

  return <Card data={data} fallbackHostname={hostname} />;
}

// ============================================================
// Loaded card
// ============================================================

function Card({
  data,
  fallbackHostname,
}: {
  data: LinkPreviewData;
  fallbackHostname: string;
}) {
  const siteName = (data.siteName || fallbackHostname).toUpperCase();
  const siteKey = siteName.toLowerCase();

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-stretch gap-3 overflow-hidden transition-colors duration-150 ease-out"
      style={{
        borderRadius: "var(--border-radius-md, 12px)",
        border: "0.5px solid var(--border)",
        backgroundColor: "var(--surface)",
        padding: "10px 12px",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--bg)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "var(--surface)";
      }}
    >
      <Thumb image={data.image} hostname={fallbackHostname} alt={data.title ?? ""} />

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <SiteLogo siteKey={siteKey} />
            <span
              className="truncate font-body text-[11px] uppercase tracking-[0.08em] text-ink-soft"
            >
              {siteName}
            </span>
          </div>
          <ExternalLink
            size={12}
            aria-hidden
            className="shrink-0 text-ink-soft"
          />
        </div>
        {data.title && (
          <div className="line-clamp-2 font-display italic text-[14px] leading-snug text-ink">
            {data.title}
          </div>
        )}
        {data.description && (
          <div className="line-clamp-1 font-body text-[12px] text-ink-soft">
            {data.description}
          </div>
        )}
      </div>
    </a>
  );
}

// ============================================================
// Thumbnail — OG image at 80x80, falls back to a centered favicon
// inside an 80x80 box at 32x32.
// ============================================================

function Thumb({
  image,
  hostname,
  alt,
}: {
  image: string | null;
  hostname: string;
  alt: string;
}) {
  const box: React.CSSProperties = {
    height: 80,
    width: 80,
    borderRadius: "var(--border-radius-sm, 8px)",
    flexShrink: 0,
  };

  if (image) {
    return (
      <div className="overflow-hidden bg-bg" style={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
    hostname,
  )}&sz=64`;

  return (
    <div
      className="flex items-center justify-center bg-bg"
      style={{ ...box, border: "0.5px solid var(--border)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={favicon}
        alt=""
        className="h-8 w-8"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

// ============================================================
// Fallback chip — shown when the fetch returned nothing useful
// (Instagram login wall, blocked TikTok embed, network failure).
// ============================================================

function FallbackChip({ url, hostname }: { url: string; hostname: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 self-start transition-colors duration-150 ease-out hover:bg-ink/5"
      style={{
        borderRadius: 999,
        border: "0.5px solid var(--border)",
        backgroundColor: "var(--surface)",
        padding: "6px 12px",
      }}
    >
      <Globe size={14} aria-hidden className="text-ink-soft" />
      <span className="font-body text-[12px] text-ink">{hostname}</span>
      <ExternalLink size={12} aria-hidden className="text-ink-soft" />
    </a>
  );
}

// ============================================================
// Skeleton — same dimensions as the loaded card so the surrounding
// layout never jumps when data resolves.
// ============================================================

function Skeleton() {
  return (
    <div
      aria-hidden
      className="link-skeleton flex items-stretch gap-3"
      style={{
        borderRadius: "var(--border-radius-md, 12px)",
        border: "0.5px solid var(--border)",
        backgroundColor: "var(--surface)",
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          height: 80,
          width: 80,
          borderRadius: "var(--border-radius-sm, 8px)",
          backgroundColor:
            "color-mix(in srgb, var(--ink) 8%, transparent)",
          flexShrink: 0,
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
        <div
          style={{
            height: 8,
            width: "30%",
            borderRadius: 4,
            backgroundColor:
              "color-mix(in srgb, var(--ink) 8%, transparent)",
          }}
        />
        <div
          style={{
            height: 12,
            width: "85%",
            borderRadius: 4,
            backgroundColor:
              "color-mix(in srgb, var(--ink) 12%, transparent)",
          }}
        />
        <div
          style={{
            height: 10,
            width: "60%",
            borderRadius: 4,
            backgroundColor:
              "color-mix(in srgb, var(--ink) 8%, transparent)",
          }}
        />
      </div>
    </div>
  );
}

// ============================================================
// Site logos — inline SVG so we don't pay a network round trip and
// don't depend on a logo library that might churn its API. Sized to
// 14×14 to sit cleanly next to the 11px UPPERCASE site label.
// ============================================================

function SiteLogo({ siteKey }: { siteKey: string }) {
  if (siteKey.includes("tiktok")) return <TikTokLogo />;
  if (siteKey.includes("youtube")) return <YouTubeLogo />;
  if (siteKey.includes("instagram")) return <InstagramLogo />;
  return null;
}

function TikTokLogo() {
  // Single-color silhouette — adapts to light/dark via currentColor.
  // Light mode reads as near-black on cream; dark reads white on ink.
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden
      className="shrink-0 text-ink"
      fill="currentColor"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.55a8.16 8.16 0 0 0 4.77 1.52V6.62a4.85 4.85 0 0 1-1.84-.07Z" />
    </svg>
  );
}

function YouTubeLogo() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8Z"
        fill="#FF0000"
      />
      <path d="M9.6 15.6 15.8 12 9.6 8.4Z" fill="#fff" />
    </svg>
  );
}

function InstagramLogo() {
  // Approximated gradient — a single warm-pink fill rather than the
  // full corner-anchored gradient, since at 14px the gradient stops
  // would be invisible anyway. Reads as "Instagram" at a glance.
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden
      className="shrink-0"
    >
      <defs>
        <linearGradient id="ig-grad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#FEDA77" />
          <stop offset="50%" stopColor="#F58529" />
          <stop offset="100%" stopColor="#DD2A7B" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="5"
        fill="url(#ig-grad)"
      />
      <circle cx="12" cy="12" r="4" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="#fff" />
    </svg>
  );
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
