"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

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
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function usePins() {
  return useQuery<Pin[]>({
    queryKey: ["pins"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("pins")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Pin[];
    },
  });
}
