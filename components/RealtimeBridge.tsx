"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useProfiles, type Profile } from "@/hooks/useProfiles";
import type { Pin } from "@/hooks/usePins";

// Tapping a partner-activity toast dispatches this on window. The page
// listens and routes to the pin (fly + open detail). Custom event
// keeps this bridge decoupled from page-level state.
export const SELECT_PIN_EVENT = "jf:select-pin";

// Skip toasts for the first 2 seconds after mount. The realtime
// channel only delivers post-subscribe events, but if the user opens
// the app during a flurry of partner activity they'd otherwise see
// notifications for things they were already about to discover.
const ARM_DELAY_MS = 2000;

interface PinInsert {
  id: string;
  title: string;
  created_by: string | null;
}
interface VisitInsert {
  id: string;
  pin_id: string;
  created_by: string | null;
}

export function RealtimeBridge() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const { data: profiles } = useProfiles();

  // Stash latest values in refs so the realtime callback sees fresh
  // state without resubscribing the channel each render.
  const currentUserIdRef = useRef<string | undefined>(undefined);
  const profilesRef = useRef<Profile[] | undefined>(undefined);
  const armedRef = useRef(false);

  useEffect(() => {
    currentUserIdRef.current = currentUser?.id;
  }, [currentUser?.id]);
  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  useEffect(() => {
    const armTimer = window.setTimeout(() => {
      armedRef.current = true;
    }, ARM_DELAY_MS);

    const supabase = createClient();

    function partnerName(createdBy: string | null): string {
      if (!createdBy) return "Someone";
      const profile = profilesRef.current?.find(
        (p) => p.user_id === createdBy,
      );
      return profile?.display_name ?? "Someone";
    }

    function notifyPinInsert(row: PinInsert) {
      if (!armedRef.current) return;
      if (!row.created_by) return;
      if (row.created_by === currentUserIdRef.current) return;
      const name = partnerName(row.created_by);
      toast(`${name} dropped a dream — ${row.title}`, {
        duration: 6000,
        action: {
          label: "Open",
          onClick: () => {
            window.dispatchEvent(
              new CustomEvent<string>(SELECT_PIN_EVENT, { detail: row.id }),
            );
          },
        },
      });
    }

    function notifyVisitInsert(row: VisitInsert) {
      if (!armedRef.current) return;
      if (!row.created_by) return;
      if (row.created_by === currentUserIdRef.current) return;

      const pins = queryClient.getQueryData<Pin[]>(["pins"]);
      const pin = pins?.find((p) => p.id === row.pin_id);
      const name = partnerName(row.created_by);
      const title = pin?.title ?? "a place you've pinned";

      toast(`${name} just lived — ${title}`, {
        duration: 6000,
        action: {
          label: "Open",
          onClick: () => {
            window.dispatchEvent(
              new CustomEvent<string>(SELECT_PIN_EVENT, {
                detail: row.pin_id,
              }),
            );
          },
        },
      });
    }

    // Coalesce invalidations. A partner logging a visit with ten photos
    // produces eleven row events within a second or two; without this each
    // one re-downloaded the full all-visits query (every visit, every photo
    // row). One refetch per key per burst is enough.
    const pendingKeys = new Set<"pins" | "visits">();
    let flushTimer: number | null = null;
    function invalidateSoon(key: "pins" | "visits") {
      pendingKeys.add(key);
      if (flushTimer != null) return;
      flushTimer = window.setTimeout(() => {
        flushTimer = null;
        for (const k of pendingKeys) {
          queryClient.invalidateQueries({ queryKey: [k] });
        }
        pendingKeys.clear();
      }, 400);
    }

    const channel = supabase
      .channel("app-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pins" },
        (payload) => {
          invalidateSoon("pins");
          if (payload.eventType === "INSERT") {
            notifyPinInsert(payload.new as PinInsert);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visits" },
        (payload) => {
          // A new/edited/deleted visit affects:
          //   - the per-pin timeline (queryKey starts with "visits")
          //   - the pin's derived has_visits flag (queryKey ["pins"])
          invalidateSoon("visits");
          invalidateSoon("pins");
          if (payload.eventType === "INSERT") {
            notifyVisitInsert(payload.new as VisitInsert);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visit_photos" },
        () => {
          invalidateSoon("visits");
        },
      )
      .subscribe();

    return () => {
      window.clearTimeout(armTimer);
      if (flushTimer != null) window.clearTimeout(flushTimer);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
}
