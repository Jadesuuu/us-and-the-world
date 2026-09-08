"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { IS_DEMO } from "@/lib/demo";

type RawPin = {
  id: string;
  space_id: string;
  title: string;
  note: string | null;
  lat: number | null;
  lng: number | null;
  is_done: boolean;
  done_at: string | null;
  memory: string | null;
  image_urls: string[] | null;
  google_place_id: string | null;
  inspiration_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  visit_day_count: number | null;
};

export type Pin = {
  id: string;
  space_id: string;
  title: string;
  note: string | null;
  lat: number | null;
  lng: number | null;
  is_done: boolean;
  done_at: string | null;
  memory: string | null;
  image_urls: string[];
  google_place_id: string | null;
  inspiration_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  visit_day_count: number;
  has_visits: boolean;
};

export function usePins() {
  return useQuery<Pin[]>({
    queryKey: ["pins"],
    queryFn: async () => {
      // Dynamic import keeps the snapshot out of the production bundle:
      // IS_DEMO folds to false at build time and this branch is dropped.
      if (IS_DEMO) return (await import("@/lib/demo-data")).DEMO_PINS;
      const supabase = createClient();
      // The view returns every column from `pins` plus visit_day_count.
      // RLS on the underlying tables still applies because the view is
      // defined with security_invoker = on (see migration 0005).
      const { data, error } = await supabase
        .from("pins_with_visit_count")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as RawPin[];
      return rows.map((p): Pin => {
        const dayCount = p.visit_day_count ?? 0;
        return {
          ...p,
          image_urls: p.image_urls ?? [],
          visit_day_count: dayCount,
          // Treat any visit day as "completed". Falls back to legacy is_done
          // for pins that were marked done before the visits migration.
          has_visits: dayCount > 0 || p.is_done,
        };
      });
    },
  });
}
