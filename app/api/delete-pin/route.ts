import { NextResponse, type NextRequest } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { createClient } from "@/lib/supabase/server";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Extract a Cloudinary public_id from a delivery URL. Handles versioned and
// transformed URLs:
//   https://res.cloudinary.com/{cloud}/image/upload/[transformations/]
//                                                  [v123/]{folder}/{id}.{ext}
function publicIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("cloudinary.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const uploadIdx = parts.indexOf("upload");
    if (uploadIdx === -1) return null;
    let i = uploadIdx + 1;
    // Skip transformation segments (any segment containing "_" of form X_value).
    while (i < parts.length && /^[a-z]_/i.test(parts[i])) i++;
    // Skip the version segment (v123).
    if (i < parts.length && /^v\d+$/.test(parts[i])) i++;
    // The remainder is the public_id (with the file extension on the last part).
    const rest = parts.slice(i).join("/");
    return rest.replace(/\.[^./]+$/, "") || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { pinId?: string };
  try {
    body = (await request.json()) as { pinId?: string };
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const pinId = body.pinId;
  if (!pinId || typeof pinId !== "string") {
    return NextResponse.json({ error: "missing pinId" }, { status: 400 });
  }

  // Fetch the pin first so we know which Cloudinary assets to clean up.
  // RLS already filters to spaces the user belongs to.
  const { data: pin, error: fetchError } = await supabase
    .from("pins")
    .select("id, created_by, image_urls")
    .eq("id", pinId)
    .single();

  if (fetchError || !pin) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (pin.created_by !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Delete the row first. The "pins delete only creator" RLS policy ensures
  // anyone bypassing the front-end check still can't delete someone else's pin.
  const { error: deleteError } = await supabase
    .from("pins")
    .delete()
    .eq("id", pinId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Best-effort Cloudinary cleanup. Failures here don't roll back the row
  // delete — the pin is already gone from the user's perspective. Orphaned
  // Cloudinary assets are recoverable manually.
  const imageUrls = (pin.image_urls ?? []) as string[];
  const publicIds = imageUrls
    .map(publicIdFromUrl)
    .filter((id: string | null): id is string => id != null && id.length > 0);

  const results = await Promise.allSettled(
    publicIds.map((id) =>
      cloudinary.uploader.destroy(id, { invalidate: true }),
    ),
  );

  const cloudinaryDeleted = results.filter((r) => r.status === "fulfilled")
    .length;

  return NextResponse.json({
    ok: true,
    cloudinaryDeleted,
    cloudinaryAttempted: publicIds.length,
  });
}
