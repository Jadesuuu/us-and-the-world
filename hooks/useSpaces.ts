"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type Space = {
  id: string;
  name: string | null;
  created_at: string;
};

export function useSpaces() {
  return useQuery<Space[]>({
    queryKey: ["spaces"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("spaces")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Space[];
    },
  });
}
