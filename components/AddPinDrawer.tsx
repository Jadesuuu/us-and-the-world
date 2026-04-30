"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useSpaces } from "@/hooks/useSpaces";

interface Props {
  open: boolean;
  pendingLatLng: { lat: number; lng: number } | null;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function AddPinDrawer({
  open,
  pendingLatLng,
  onClose,
  onSubmitted,
}: Props) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();
  const { data: spaces } = useSpaces();
  const spaceId = spaces?.[0]?.id;

  useEffect(() => {
    if (!open) {
      setTitle("");
      setNote("");
    }
  }, [open]);

  const insertPin = useMutation({
    mutationFn: async () => {
      if (!spaceId) throw new Error("No space available");
      if (!pendingLatLng) throw new Error("No location set");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from("pins").insert({
        space_id: spaceId,
        title: title.trim(),
        note: note.trim() || null,
        lat: pendingLatLng.lat,
        lng: pendingLatLng.lng,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pins"] });
      onSubmitted();
    },
  });

  if (!open) return null;

  const canSubmit =
    title.trim().length > 0 &&
    pendingLatLng != null &&
    spaceId != null &&
    !insertPin.isPending;

  return (
    <div
      role="dialog"
      aria-label="New pin"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto rounded-t-2xl border-t border-zinc-800 bg-zinc-950 shadow-2xl"
    >
      <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-zinc-700" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) insertPin.mutate();
        }}
        className="flex flex-col gap-4 px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">New pin</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            ×
          </button>
        </div>

        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            pendingLatLng
              ? "border-emerald-700/40 bg-emerald-500/10 text-emerald-300"
              : "border-zinc-800 bg-zinc-900 text-zinc-400"
          }`}
        >
          {pendingLatLng
            ? `Location: ${pendingLatLng.lat.toFixed(4)}, ${pendingLatLng.lng.toFixed(4)}`
            : "Tap on the map to set a location"}
        </div>

        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="h-12 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 text-base text-white outline-none focus:border-zinc-500"
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          rows={3}
          className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-base text-white outline-none focus:border-zinc-500"
        />

        {insertPin.error && (
          <p className="text-sm text-red-500">
            {(insertPin.error as Error).message}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="h-12 w-full rounded-lg bg-white text-base font-medium text-zinc-950 transition-colors hover:bg-zinc-200 disabled:opacity-50"
        >
          {insertPin.isPending ? "Saving…" : "Add pin"}
        </button>
      </form>
    </div>
  );
}
