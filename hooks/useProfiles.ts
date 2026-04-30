"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

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
      const supabase = createClient();
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
