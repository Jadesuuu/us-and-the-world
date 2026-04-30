import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "Cloudinary is not configured" },
      { status: 500 },
    );
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder = "memories";

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    apiSecret,
  );

  return NextResponse.json({
    signature,
    timestamp,
    cloudName,
    apiKey,
    folder,
  });
}
