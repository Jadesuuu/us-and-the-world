"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function RealtimeBridge() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("app-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pins" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pins"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visits" },
        () => {
          // A new/edited/deleted visit affects:
          //   - the per-pin timeline (queryKey starts with "visits")
          //   - the pin's derived has_visits flag (queryKey ["pins"])
          queryClient.invalidateQueries({ queryKey: ["visits"] });
          queryClient.invalidateQueries({ queryKey: ["pins"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visit_photos" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["visits"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
}
