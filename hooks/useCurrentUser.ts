"use client";

import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { DEMO_VIEWER_ID, IS_DEMO } from "@/lib/demo";

// In demo mode there is no session. We hand back a minimal stand-in user
// whose id matches nobody's created_by, so ownership-gated UI stays hidden
// while components that only need "some user" keep working.
const DEMO_USER = {
  id: DEMO_VIEWER_ID,
  aud: "demo",
  app_metadata: {},
  user_metadata: {},
  created_at: "",
} as unknown as User;

export function useCurrentUser() {
  return useQuery<User | null>({
    queryKey: ["currentUser"],
    queryFn: async () => {
      if (IS_DEMO) return DEMO_USER;
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user;
    },
    staleTime: Infinity,
  });
}
