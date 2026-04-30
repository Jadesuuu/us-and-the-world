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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
}
