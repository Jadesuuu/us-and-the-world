"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { IS_DEMO } from "@/lib/demo";

export type VisitPhoto = {
  id: string;
  visit_id: string;
  image_url: string;
  public_id: string | null;
  created_at: string;
  // Optional photo credit. Only set on demo-snapshot photos sourced from
  // Wikimedia Commons; user uploads never carry one.
  attribution?: string | null;
};

export type Visit = {
  id: string;
  pin_id: string;
  space_id: string;
  visited_at: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
  visit_photos: VisitPhoto[];
};

export function usePinVisits(pinId: string | null) {
  return useQuery<Visit[]>({
    queryKey: ["visits", pinId],
    enabled: pinId != null,
    queryFn: async () => {
      if (!pinId) return [];
      if (IS_DEMO) {
        const { DEMO_VISITS } = await import("@/lib/demo-data");
        return DEMO_VISITS.filter((v) => v.pin_id === pinId);
      }
      const supabase = createClient();
      const { data, error } = await supabase
        .from("visits")
        .select("*, visit_photos(*)")
        .eq("pin_id", pinId)
        .order("visited_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Visit[];
    },
  });
}
