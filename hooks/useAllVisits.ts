"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Visit } from "./usePinVisits";

export type VisitWithPin = Visit & {
  pin: { id: string; title: string } | null;
};

export function useAllVisits() {
  return useQuery<VisitWithPin[]>({
    queryKey: ["visits", "all"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("visits")
        .select("*, visit_photos(*), pin:pins(id, title)")
        .order("visited_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VisitWithPin[];
    },
  });
}
