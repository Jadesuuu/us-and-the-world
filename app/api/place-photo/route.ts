import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Validate the photo identifier looks like a Google Places photo resource
// path: "places/{placeId}/photos/{photoId}". Refuse anything else so this
// endpoint can't be turned into an open proxy for arbitrary URLs.
const PHOTO_REF_RE = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ref = request.nextUrl.searchParams.get("ref");
  if (!ref || !PHOTO_REF_RE.test(ref)) {
    return NextResponse.json(
      { error: "missing or invalid ref" },
      { status: 400 },
    );
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY not configured" },
      { status: 500 },
    );
  }

  const upstream = `https://places.googleapis.com/v1/${ref}/media?maxHeightPx=400`;
  const res = await fetch(upstream, {
    headers: { "X-Goog-Api-Key": apiKey },
    redirect: "follow",
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `upstream ${res.status}` },
      { status: 502 },
    );
  }

  const body = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "image/jpeg";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=86400, immutable",
    },
  });
}
