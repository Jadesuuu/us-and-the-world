import { NextResponse, type NextRequest } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { createClient } from "@/lib/supabase/server";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function publicIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("cloudinary.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const uploadIdx = parts.indexOf("upload");
    if (uploadIdx === -1) return null;
    let i = uploadIdx + 1;
    while (i < parts.length && /^[a-z]_/i.test(parts[i])) i++;
    if (i < parts.length && /^v\d+$/.test(parts[i])) i++;
    const rest = parts.slice(i).join("/");
    return rest.replace(/\.[^./]+$/, "") || null;
  } catch {
    return null;
  }
}

type VisitPhotoRow = { id: string; image_url: string; public_id: string | null };
type VisitRow = {
  id: string;
  created_by: string | null;
  visit_photos: VisitPhotoRow[];
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { visitId?: string };
  try {
    body = (await request.json()) as { visitId?: string };
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const visitId = body.visitId;
  if (!visitId || typeof visitId !== "string") {
    return NextResponse.json({ error: "missing visitId" }, { status: 400 });
  }

  const { data: visit, error: fetchError } = await supabase
    .from("visits")
    .select("id, created_by, visit_photos(id, image_url, public_id)")
    .eq("id", visitId)
    .single<VisitRow>();

  if (fetchError || !visit) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (visit.created_by !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Cascade delete: visit_photos rows go away with the visit row.
  const { error: deleteError } = await supabase
    .from("visits")
    .delete()
    .eq("id", visitId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Best-effort Cloudinary cleanup. Use stored public_id when present;
  // fall back to parsing the URL for legacy/backfilled rows.
  const publicIds = visit.visit_photos
    .map((p) => p.public_id ?? publicIdFromUrl(p.image_url))
    .filter((id: string | null): id is string => id != null && id.length > 0);

  await Promise.allSettled(
    publicIds.map((id) =>
      cloudinary.uploader.destroy(id, { invalidate: true }),
    ),
  );

  return NextResponse.json({ ok: true });
}
