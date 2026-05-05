import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Open-Graph metadata fetcher for the inspiration-link card.
//
// Why this lives server-side: third-party sites (TikTok, YouTube, IG)
// don't ship CORS headers for their HTML, so the browser can't fetch
// their pages directly. A server-side fetch also keeps the user's IP
// out of random hosts they didn't intentionally visit.
//
// Auth-gated like the other JSON endpoints in this app — defense in
// depth so a public scraper can't ride this route as an open proxy.

// Matches obvious private / loopback IPv4 literals. We don't resolve
// DNS (that's a rabbit hole with rebinding attacks); the goal is just
// to reject the lazy "fetch http://10.0.0.5/internal" SSRF attempts.
function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0" || h === "::1" || h === "[::1]") return true;
  if (h.startsWith("127.")) return true;
  if (h.startsWith("10.")) return true;
  if (h.startsWith("192.168.")) return true;
  if (/^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return true;
  return false;
}

interface LinkPreview {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string;
  url: string;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "invalid protocol" }, { status: 400 });
  }
  if (isBlockedHostname(parsed.hostname)) {
    return NextResponse.json({ error: "blocked host" }, { status: 400 });
  }

  const hostname = parsed.hostname.replace(/^www\./, "");
  const fallback: LinkPreview = {
    title: null,
    description: null,
    image: null,
    siteName: hostname,
    url: parsed.toString(),
  };

  try {
    const res = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JFWorldBot/1.0)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return cached(NextResponse.json(fallback));
    }

    const html = await res.text();
    const meta = parseOpenGraph(html, parsed);

    return cached(NextResponse.json(meta));
  } catch {
    // Network error, timeout, or non-text response — return the
    // fallback at HTTP 200 so the client renders the chip-style
    // fallback instead of an error toast. Same shape as success.
    return cached(NextResponse.json(fallback));
  }
}

// Tag the response with a 24h public cache header. Link metadata
// rarely changes, and the client's TanStack Query staleTime backs
// this up for the same window.
function cached(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "public, max-age=86400");
  return res;
}

function parseOpenGraph(html: string, parsed: URL): LinkPreview {
  const ogTitle = matchMetaProperty(html, "og:title");
  const ogDesc = matchMetaProperty(html, "og:description");
  const ogImage = matchMetaProperty(html, "og:image");
  const ogSite = matchMetaProperty(html, "og:site_name");
  const nameTitle = matchMetaName(html, "title");
  const nameDesc = matchMetaName(html, "description");
  const docTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();

  const hostname = parsed.hostname.replace(/^www\./, "");
  const image = ogImage ? toAbsolute(ogImage, parsed) : null;

  return {
    title: ogTitle ?? nameTitle ?? docTitle ?? null,
    description: ogDesc ?? nameDesc ?? null,
    image,
    siteName: ogSite ?? hostname,
    url: parsed.toString(),
  };
}

// Two regexes per tag because the property/content attribute order
// isn't guaranteed (some templating engines emit `content` first).
function matchMetaProperty(html: string, prop: string): string | null {
  const a = html.match(
    new RegExp(
      `<meta[^>]*property=["']${escapeRe(prop)}["'][^>]*content=["']([^"']+)["']`,
      "i",
    ),
  );
  if (a) return decodeEntities(a[1]);
  const b = html.match(
    new RegExp(
      `<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${escapeRe(prop)}["']`,
      "i",
    ),
  );
  return b ? decodeEntities(b[1]) : null;
}

function matchMetaName(html: string, name: string): string | null {
  const m = html.match(
    new RegExp(
      `<meta[^>]*name=["']${escapeRe(name)}["'][^>]*content=["']([^"']+)["']`,
      "i",
    ),
  );
  return m ? decodeEntities(m[1]) : null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Absolute URL resolution for og:image — some sites emit relative or
// protocol-relative paths. URL() handles both when given a base.
function toAbsolute(value: string, base: URL): string {
  try {
    return new URL(value, base).toString();
  } catch {
    return value;
  }
}

// Minimal entity decode — covers the four characters most likely to
// appear in og:title / og:description text. Anything more exotic we
// pass through as-is rather than ship a full HTML decoder.
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}
