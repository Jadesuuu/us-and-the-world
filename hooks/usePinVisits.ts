"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type VisitPhoto = {
  id: string;
  visit_id: string;
  image_url: string;
  public_id: string | null;
  created_at: string;
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
