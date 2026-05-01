"use client";

import { Drawer } from "vaul";
import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useSpaces } from "@/hooks/useSpaces";
import { usePins } from "@/hooks/usePins";
import { findExistingPin } from "@/lib/geo";

interface BaseProps {
  pendingLatLng: { lat: number; lng: number } | null;
  prefillTitle?: string;
  onClose: () => void;
  onSubmitted: (newPinId: string) => void;
  onOpenExistingPin?: (pinId: string) => void;
}

interface DrawerProps extends BaseProps {
  open: boolean;
}

// AddPinDrawer is the only drawer that runs modal={false}: its core
// flow is "tap somewhere on the map to set a location," which an
// overlay would block. Swipe-down still dismisses (Vaul default), and
// the explicit × button + Cancel-on-close handlers cover the rest.
export default function AddPinDrawer(props: DrawerProps) {
  return (
    <Drawer.Root
      open={props.open}
      onOpenChange={(o) => {
        if (!o) props.onClose();
      }}
      modal={false}
      dismissible
    >
      <Drawer.Portal>
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-40 mx-auto rounded-t-3xl bg-bg shadow-xl outline-none"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-ink-soft/40" />
          <Drawer.Title className="sr-only">Drop a dream</Drawer.Title>
          {props.open && (
            <AddPinForm
              pendingLatLng={props.pendingLatLng}
              prefillTitle={props.prefillTitle}
              onClose={props.onClose}
              onSubmitted={props.onSubmitted}
              onOpenExistingPin={props.onOpenExistingPin}
              layout="drawer"
            />
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

interface FormProps extends BaseProps {
  // "drawer" gets the mobile-style header with × close.
  // "panel" gets a desktop-style header with no chrome — the parent
  // (DesktopSidebar) renders its own back button.
  layout: "drawer" | "panel";
}

export function AddPinForm({
  pendingLatLng,
  prefillTitle,
  onClose,
  onSubmitted,
  onOpenExistingPin,
  layout,
}: FormProps) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [acknowledgedDuplicate, setAcknowledgedDuplicate] = useState(false);
  const queryClient = useQueryClient();
  const { data: spaces } = useSpaces();
  const { data: pins } = usePins();
  const spaceId = spaces?.[0]?.id;

  const nearbyExistingPin = useMemo(() => {
    if (!pendingLatLng) return null;
    return findExistingPin(pendingLatLng, pins);
  }, [pendingLatLng, pins]);

  // Reset on remount or when prefill changes (mobile: drawer reopens).
  // Panel layout stays mounted across uses, so mirror the same reset
  // by keying on prefillTitle changes.
  useEffect(() => {
    setTitle(prefillTitle ?? "");
    setNote("");
    setAcknowledgedDuplicate(false);
  }, [prefillTitle]);

  // Reset acknowledgment if the user picks a different point on the map.
  useEffect(() => {
    setAcknowledgedDuplicate(false);
  }, [pendingLatLng?.lat, pendingLatLng?.lng]);

  const insertPin = useMutation({
    mutationFn: async (): Promise<string> => {
      if (!spaceId) throw new Error("No space available");
      if (!pendingLatLng) throw new Error("No location set");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("pins")
        .insert({
          space_id: spaceId,
          title: title.trim(),
          note: note.trim() || null,
          lat: pendingLatLng.lat,
          lng: pendingLatLng.lng,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ["pins"] });
      onSubmitted(newId);
    },
  });

  const showDuplicateWarning =
    nearbyExistingPin != null && !acknowledgedDuplicate;

  const canSubmit =
    title.trim().length > 0 &&
    pendingLatLng != null &&
    spaceId != null &&
    !insertPin.isPending;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // If we're showing the duplicate warning, the explicit "Pin a
        // new one anyway" button is the only path forward — never fire
        // the mutation from the implicit form submit.
        if (showDuplicateWarning) return;
        if (canSubmit) insertPin.mutate();
      }}
      className={
        layout === "drawer"
          ? "flex flex-col gap-4 px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-4"
          : "flex flex-col gap-4 px-5 pb-6 pt-2"
      }
    >
      {layout === "drawer" && (
        <div className="flex items-center justify-between">
          <h2 className="font-display italic text-2xl text-ink">
            Drop a dream
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 rounded-full text-ink-soft"
          >
            ×
          </button>
        </div>
      )}

      {layout === "panel" && (
        <h2 className="font-display italic text-[22px] text-ink">
          Drop a dream
        </h2>
      )}

      <div
        className="rounded-xl bg-surface px-4 py-3 text-sm"
        style={{
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: pendingLatLng ? "var(--accent-2)" : "var(--border)",
          color: pendingLatLng ? "var(--accent-2)" : "var(--ink-soft)",
        }}
      >
        {pendingLatLng
          ? `pinned at ${pendingLatLng.lat.toFixed(3)}, ${pendingLatLng.lng.toFixed(3)}`
          : "Tap on the map to set a location"}
      </div>

      <input
        type="text"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="what's the dream?"
        className="h-12 w-full rounded-lg bg-surface px-4 text-base text-ink outline-none placeholder:text-ink-soft"
        style={{ border: "1px solid var(--border)" }}
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="anything you want to remember about it"
        rows={3}
        className="w-full resize-none rounded-lg bg-surface px-4 py-3 text-base text-ink outline-none placeholder:text-ink-soft"
        style={{ border: "1px solid var(--border)" }}
      />

      {insertPin.error && (
        <p className="text-sm text-accent">
          {(insertPin.error as Error).message}
        </p>
      )}

      {showDuplicateWarning && nearbyExistingPin && (
        <div
          className="flex flex-col gap-3 rounded-xl px-4 py-3"
          style={{
            border: "1px solid var(--accent-2)",
            backgroundColor:
              "color-mix(in srgb, var(--accent-2) 12%, transparent)",
          }}
        >
          <p className="text-[14px] text-ink">
            Looks like you already pinned{" "}
            <span className="font-display italic">
              {nearbyExistingPin.title}
            </span>{" "}
            near here.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                if (onOpenExistingPin) {
                  onOpenExistingPin(nearbyExistingPin.id);
                } else {
                  onClose();
                }
              }}
              className="h-10 flex-1 rounded-lg bg-accent-2 font-display italic text-[14px] text-bg"
            >
              Open the existing one
            </button>
            <button
              type="button"
              onClick={() => setAcknowledgedDuplicate(true)}
              className="h-10 flex-1 rounded-lg text-[14px] text-ink-soft"
              style={{ border: "1px solid var(--border)" }}
            >
              Pin a new one anyway
            </button>
          </div>
        </div>
      )}

      {!showDuplicateWarning && (
        <button
          type="submit"
          disabled={!canSubmit}
          className="h-12 w-full rounded-lg bg-accent font-display italic text-lg text-bg disabled:opacity-50"
        >
          {insertPin.isPending ? "saving…" : "Drop a dream"}
        </button>
      )}
    </form>
  );
}
