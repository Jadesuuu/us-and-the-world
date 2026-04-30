"use client";

import { Drawer } from "vaul";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { uploadPhoto } from "@/lib/upload";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { Pin } from "@/hooks/usePins";

interface Props {
  pin: Pin | null;
  onClose: () => void;
  readOnly?: boolean;
}

export default function PinDrawer({ pin, onClose, readOnly = false }: Props) {
  const open = pin != null;

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      modal={false}
    >
      <Drawer.Portal>
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-zinc-800 bg-zinc-950 outline-none">
          <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-zinc-700" />
          {pin && <PinDrawerBody pin={pin} readOnly={readOnly} />}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function PinDrawerBody({ pin, readOnly }: { pin: Pin; readOnly: boolean }) {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const isCreator = currentUser?.id === pin.created_by;
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setConfirmingDelete(false);
  }, [pin.id]);

  useEffect(() => {
    if (!confirmingDelete) return;
    const t = setTimeout(() => setConfirmingDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmingDelete]);

  const deletePin = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("pins")
        .delete()
        .eq("id", pin.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pins"] });
    },
  });

  const toggleDone = useMutation({
    mutationFn: async ({ id, isDone }: { id: string; isDone: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("pins")
        .update({
          is_done: isDone,
          done_at: isDone ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, isDone }) => {
      await queryClient.cancelQueries({ queryKey: ["pins"] });
      const previous = queryClient.getQueryData<Pin[]>(["pins"]);
      const stamp = isDone ? new Date().toISOString() : null;
      queryClient.setQueryData<Pin[]>(["pins"], (old) =>
        (old ?? []).map((p) =>
          p.id === id ? { ...p, is_done: isDone, done_at: stamp } : p,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(["pins"], ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pins"] });
    },
  });

  return (
    <div className="overflow-y-auto px-6 pb-8 pt-4">
      <Drawer.Title className="text-xl font-semibold text-white">
        {pin.title}
      </Drawer.Title>
      {pin.note && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-400">
          {pin.note}
        </p>
      )}

      {(pin.image_urls ?? []).length > 0 && (
        <div className="mt-4 -mx-6 flex gap-2 overflow-x-auto px-6 pb-2">
          {(pin.image_urls ?? []).map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={`Memory ${i + 1}`}
              className="h-56 w-56 flex-shrink-0 rounded-xl object-cover"
            />
          ))}
        </div>
      )}

      {readOnly ? (
        <>
          {pin.is_done && pin.done_at && (
            <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
              <div className="text-sm font-medium text-emerald-400">Done</div>
              <div className="text-xs text-zinc-500">
                {new Date(pin.done_at).toLocaleString()}
              </div>
            </div>
          )}
          {pin.memory && (
            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="text-sm font-medium text-white">Memory</div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">
                {pin.memory}
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mt-6 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-white">Done</div>
              {pin.done_at && (
                <div className="text-xs text-zinc-500">
                  {new Date(pin.done_at).toLocaleString()}
                </div>
              )}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={pin.is_done}
              onClick={() =>
                toggleDone.mutate({ id: pin.id, isDone: !pin.is_done })
              }
              className={`relative h-7 w-12 rounded-full transition-colors ${
                pin.is_done ? "bg-emerald-500" : "bg-zinc-700"
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                  pin.is_done ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {pin.is_done && <MemorySection pin={pin} />}

          {isCreator && (
            <button
              type="button"
              disabled={deletePin.isPending}
              onClick={() => {
                if (confirmingDelete) {
                  deletePin.mutate();
                } else {
                  setConfirmingDelete(true);
                }
              }}
              className={`mt-4 h-10 w-full rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${
                confirmingDelete
                  ? "border-red-500 bg-red-600 text-white hover:bg-red-700"
                  : "border-red-900/40 bg-red-950/30 text-red-400 hover:bg-red-950/60"
              }`}
            >
              {deletePin.isPending
                ? "Deleting…"
                : confirmingDelete
                  ? "Tap again to confirm"
                  : "Delete pin"}
            </button>
          )}
          {deletePin.error && (
            <p className="mt-2 text-xs text-red-500">
              {(deletePin.error as Error).message}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function MemorySection({ pin }: { pin: Pin }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [memory, setMemory] = useState(pin.memory ?? "");
  const [uploadingCount, setUploadingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMemory(pin.memory ?? "");
  }, [pin.id, pin.memory]);

  const saveMemory = useMutation({
    mutationFn: async (updates: {
      image_urls?: string[];
      memory?: string | null;
    }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("pins")
        .update(updates)
        .eq("id", pin.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pins"] }),
  });

  async function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setError(null);
    setUploadingCount(files.length);
    try {
      const results = await Promise.all(files.map((f) => uploadPhoto(f)));
      const newUrls = results.map((r) => r.url);
      const next = [...(pin.image_urls ?? []), ...newUrls];
      await saveMemory.mutateAsync({
        image_urls: next,
        memory: memory.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingCount(0);
    }
  }

  const uploading = uploadingCount > 0;
  const hasPhotos = (pin.image_urls ?? []).length > 0;

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="text-sm font-medium text-white">Memory</div>
      <textarea
        value={memory}
        onChange={(e) => setMemory(e.target.value)}
        placeholder="What do you want to remember?"
        rows={3}
        className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-zinc-500"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={onFilesSelected}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
        className="h-10 w-full rounded-lg bg-white text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200 disabled:opacity-50"
      >
        {uploading
          ? `Uploading ${uploadingCount} photo${uploadingCount === 1 ? "" : "s"}…`
          : hasPhotos
            ? "Add more photos"
            : "Add memory photos"}
      </button>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
