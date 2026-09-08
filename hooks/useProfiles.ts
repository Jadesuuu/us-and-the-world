"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { IS_DEMO } from "@/lib/demo";
import { DEMO_PROFILES } from "@/lib/demo-data";

export type Profile = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string | null;
};

export function useProfiles() {
  return useQuery<Profile[]>({
    queryKey: ["profiles"],
    queryFn: async () => {
      if (IS_DEMO) return DEMO_PROFILES;
      const supabase = createClient();
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
