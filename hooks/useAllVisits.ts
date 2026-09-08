"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { IS_DEMO } from "@/lib/demo";
import type { Visit } from "./usePinVisits";

export type VisitWithPin = Visit & {
  pin: { id: string; title: string } | null;
};

export function useAllVisits() {
  return useQuery<VisitWithPin[]>({
    queryKey: ["visits", "all"],
    queryFn: async () => {
      if (IS_DEMO) return (await import("@/lib/demo-data")).DEMO_VISITS;
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
