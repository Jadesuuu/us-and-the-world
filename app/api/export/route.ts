import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: pins, error } = await supabase
    .from("pins")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      exported_at: new Date().toISOString(),
      user_id: user.id,
      count: pins?.length ?? 0,
      pins: pins ?? [],
    },
    {
      headers: {
        "Content-Disposition": `attachment; filename="us-and-the-world-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    },
  );
}
