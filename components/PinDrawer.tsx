"use client";

import { Drawer } from "vaul";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { uploadPhoto } from "@/lib/upload";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useProfiles, type Profile } from "@/hooks/useProfiles";
import { usePinVisits, type Visit, type VisitPhoto } from "@/hooks/usePinVisits";
import type { VisitWithPin } from "@/hooks/useAllVisits";
import { formatLongDate } from "@/lib/format";
import { Toggle } from "./ui/Toggle";
import { toast } from "sonner";
import type { Pin } from "@/hooks/usePins";
import ImageLightbox from "./ImageLightbox";
import {
  useScrollShadows,
  SCROLL_SHADOW_TOP,
  SCROLL_SHADOW_BOTTOM,
} from "@/lib/use-scroll-shadows";

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
      modal
      dismissible
    >
      <Drawer.Portal>
        {/* Overlay sits above the map (z-30) so a tap on the map area
            actually hits the overlay and closes the drawer. */}
        <Drawer.Overlay
          className="fixed inset-0 z-30"
          style={{ backgroundColor: "color-mix(in srgb, var(--ink) 25%, transparent)" }}
        />
        <Drawer.Content
          className={`fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-3xl bg-bg outline-none ${
            readOnly ? "max-h-[70vh]" : "max-h-[85vh]"
          }`}
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-ink-soft/40" />
          {pin && (
            <PinContent
              layout="drawer"
              pin={pin}
              readOnly={readOnly}
              onClose={onClose}
            />
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

// Body is exported so the desktop sidebar can render it directly,
// outside any Vaul context.
//
// layout="drawer" — single overflow-y-auto column for Vaul's mobile
//   drawer; action buttons live at the bottom of the scrollable list.
// layout="panel"  — flex column with sticky footer for the desktop
//   sidebar; "Log another visit" + "Delete pin" pin to the bottom of
//   the sidebar regardless of timeline length.
export function PinContent({
  pin,
  readOnly,
  onClose,
  layout,
}: {
  pin: Pin;
  readOnly: boolean;
  onClose: () => void;
  layout: "drawer" | "panel";
}) {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const { data: visits = [] } = usePinVisits(pin.id);
  const { data: profiles } = useProfiles();
  const isCreator = currentUser?.id === pin.created_by;
  const hasVisits = visits.length > 0;

  const profilesByUser = useMemo(() => {
    const m: Record<string, Profile> = {};
    (profiles ?? []).forEach((p) => {
      m[p.user_id] = p;
    });
    return m;
  }, [profiles]);
  const showChips = (profiles?.length ?? 0) >= 2;

  const [logFormOpen, setLogFormOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Lightbox holds the *exact* photo array currently being shown plus
  // the active index. The array is the day-group's flat list (across
  // visits in that day) so navigation is contiguous within the strip
  // the user opened from.
  const [lightbox, setLightbox] = useState<{
    photos: VisitPhoto[];
    index: number;
  } | null>(null);

  useEffect(() => {
    setLogFormOpen(false);
    setConfirmingDelete(false);
  }, [pin.id]);

  useEffect(() => {
    if (!confirmingDelete) return;
    const t = setTimeout(() => setConfirmingDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmingDelete]);

  // Optimistic delete with a 4-second undo window. The pin AND every
  // visit that belongs to it disappear from cache immediately. The
  // actual API call is deferred so undo simply cancels the timer and
  // restores both snapshots. If the timer expires the API runs and the
  // rows are permanently removed (server cascades visits + Cloudinary).
  function handleDeletePin() {
    const pinId = pin.id;

    // Snapshot every cache that's affected so undo / error rollback
    // restore the exact prior state, including any partner-side
    // realtime updates that landed in between.
    const previousPins = queryClient.getQueryData<Pin[]>(["pins"]);
    const visitSnapshots = queryClient.getQueriesData({
      queryKey: ["visits"],
    });

    // Optimistic write: remove this pin from the pins cache and remove
    // every visit attached to it from any visits-* cache.
    queryClient.setQueryData<Pin[]>(["pins"], (old) =>
      (old ?? []).filter((p) => p.id !== pinId),
    );
    for (const [key, data] of visitSnapshots) {
      if (!Array.isArray(data)) continue;
      queryClient.setQueryData(
        key,
        (data as { pin_id: string }[]).filter((v) => v.pin_id !== pinId),
      );
    }

    function restoreSnapshots() {
      if (previousPins) {
        queryClient.setQueryData(["pins"], previousPins);
      }
      for (const [key, data] of visitSnapshots) {
        queryClient.setQueryData(key, data);
      }
    }

    onClose();

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      if (cancelled) return;
      try {
        const res = await fetch("/api/delete-pin", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pinId }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        queryClient.invalidateQueries({ queryKey: ["pins"] });
        queryClient.invalidateQueries({ queryKey: ["visits"] });
      } catch {
        restoreSnapshots();
        toast.error("Couldn't delete that pin — try again?");
      }
    }, 4000);

    toast("Pin removed", {
      duration: 4000,
      action: {
        label: "Undo",
        onClick: () => {
          cancelled = true;
          window.clearTimeout(timeoutId);
          restoreSnapshots();
        },
      },
    });
  }

  // Footer-eligible buttons: shown only when there's something to put
  // there. The log-visit form is its own mini-form with internal
  // Cancel/Save buttons, so we hide the panel footer while it's open.
  const showLogAnotherVisit = !readOnly && hasVisits && !logFormOpen;
  const showDeleteButton = isCreator;
  const hasFooter = showLogAnotherVisit || showDeleteButton;

  const title = (
    <h2
      data-pin-title
      className="font-display italic text-[28px] font-normal leading-tight text-ink"
    >
      {pin.title}
    </h2>
  );

  const note = pin.note ? (
    <p className="mt-2 whitespace-pre-wrap text-[15px] text-ink-soft">
      {pin.note}
    </p>
  ) : null;

  const timeline = hasVisits ? (
    <VisitTimeline
      visits={visits}
      currentUserId={currentUser?.id ?? null}
      profilesByUser={profilesByUser}
      showChips={showChips}
      onPhotoClick={(photos, index) => setLightbox({ photos, index })}
    />
  ) : null;

  const toggleRow =
    !readOnly && !hasVisits ? (
      <div
        className="mt-6 flex items-center justify-between rounded-xl bg-bg px-4 py-3"
        style={{ border: "1px solid var(--border)" }}
      >
        <div className="font-display italic text-base text-ink">
          We did it
        </div>
        <Toggle
          checked={logFormOpen}
          onChange={setLogFormOpen}
          label="We did it"
        />
      </div>
    ) : null;

  const logForm =
    !readOnly && logFormOpen ? (
      <LogVisitForm
        pinId={pin.id}
        spaceId={pin.space_id}
        onSaved={() => setLogFormOpen(false)}
        onCancel={() => setLogFormOpen(false)}
      />
    ) : null;

  const logAnotherButton = showLogAnotherVisit ? (
    <button
      type="button"
      onClick={() => setLogFormOpen(true)}
      className="h-12 w-full rounded-lg bg-accent font-display italic text-[16px] text-bg"
    >
      Log another visit
    </button>
  ) : null;

  const deleteButton = showDeleteButton ? (
    <button
      type="button"
      onClick={() => {
        if (confirmingDelete) {
          handleDeletePin();
        } else {
          setConfirmingDelete(true);
        }
      }}
      className="h-10 w-full rounded-lg text-sm"
      style={{
        border: confirmingDelete
          ? "1px solid var(--accent)"
          : "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
        backgroundColor: confirmingDelete
          ? "var(--accent)"
          : "color-mix(in srgb, var(--accent) 10%, transparent)",
        color: confirmingDelete ? "var(--bg)" : "var(--accent)",
      }}
    >
      {confirmingDelete ? "Tap again to confirm" : "Delete pin"}
    </button>
  ) : null;

  const lightboxNode = (
    <ImageLightbox
      photos={(lightbox?.photos ?? []).map((p) => ({
        url: p.image_url,
        alt: pin.title,
      }))}
      initialIndex={lightbox?.index ?? 0}
      open={lightbox != null}
      onClose={() => setLightbox(null)}
    />
  );

  if (layout === "drawer") {
    // Mobile Vaul drawer: single scrolling column with action buttons
    // at the bottom of the scroll. Same as before the refactor.
    return (
      <div className="overflow-y-auto px-6 pb-8 pt-4">
        {title}
        {note}
        {timeline}
        {toggleRow}
        {logForm}
        {logAnotherButton && (
          <div className="mt-6">{logAnotherButton}</div>
        )}
        {deleteButton && <div className="mt-4">{deleteButton}</div>}
        {lightboxNode}
      </div>
    );
  }

  return (
    <PanelLayout
      hasFooter={hasFooter}
      footer={
        <div className="flex flex-col gap-3">
          {logAnotherButton}
          {deleteButton}
        </div>
      }
    >
      <div className="px-6 pb-6 pt-4">
        {title}
        {note}
        {timeline}
        {toggleRow}
        {logForm}
      </div>
      {lightboxNode}
    </PanelLayout>
  );
}

// Reusable scrollable + sticky-footer body for desktop sidebar panels.
function PanelLayout({
  children,
  footer,
  hasFooter,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
  hasFooter: boolean;
}) {
  const { topSentinelRef, bottomSentinelRef, topShadow, bottomShadow } =
    useScrollShadows();

  return (
    <div className="flex h-full flex-col bg-surface">
      <div
        className="sidebar-scroll flex-1 overflow-y-auto"
        style={{
          minHeight: 0,
          boxShadow: topShadow ? SCROLL_SHADOW_TOP : "none",
          transition: "box-shadow 200ms ease-out",
        }}
      >
        <div ref={topSentinelRef} style={{ height: 1 }} />
        {children}
        <div ref={bottomSentinelRef} style={{ height: 1 }} />
      </div>
      {hasFooter && (
        <div
          className="shrink-0 bg-surface px-6 py-4"
          style={{
            borderTop: "0.5px solid var(--border)",
            boxShadow: bottomShadow ? SCROLL_SHADOW_BOTTOM : "none",
            transition: "box-shadow 200ms ease-out",
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Day grouping
// ============================================================

interface DayGroup {
  date: string; // YYYY-MM-DD in user's local timezone
  visits: Visit[];
}

function groupVisitsByDate(visits: Visit[]): DayGroup[] {
  const groups = new Map<string, Visit[]>();
  for (const v of visits) {
    // en-CA gives the locale-stable YYYY-MM-DD format. The visit's
    // visited_at is interpreted in the user's local timezone, so a visit
    // at 11:30pm UTC on Apr 27 might bucket into Apr 28 for a +1 user.
    // That's the intended behavior — calendar days are local.
    const dateKey = new Date(v.visited_at).toLocaleDateString("en-CA");
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey)!.push(v);
  }
  return Array.from(groups.entries())
    .map(([date, dayVisits]) => ({
      date,
      visits: dayVisits.sort(
        (a, b) =>
          new Date(a.visited_at).getTime() - new Date(b.visited_at).getTime(),
      ),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function formatTimeOfDay(iso: string): string {
  const d = new Date(iso);
  return d
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .toLowerCase(); // "3:14 PM" -> "3:14 pm"
}

export function ordinalTimeLabel(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th time`;
  switch (n % 10) {
    case 1:
      return `${n}st time`;
    case 2:
      return `${n}nd time`;
    case 3:
      return `${n}rd time`;
    default:
      return `${n}th time`;
  }
}

// ============================================================
// Timeline
// ============================================================

function VisitTimeline({
  visits,
  currentUserId,
  profilesByUser,
  showChips,
  onPhotoClick,
}: {
  visits: Visit[];
  currentUserId: string | null;
  profilesByUser: Record<string, Profile>;
  showChips: boolean;
  onPhotoClick: (photos: VisitPhoto[], index: number) => void;
}) {
  const groups = useMemo(() => groupVisitsByDate(visits), [visits]);

  // Day-level ordinals: earliest day = 1st time. Day "April 1" with two
  // visits is still "1st time", and a visit on April 28 is "2nd time".
  const dayOrdinalByDate = useMemo(() => {
    const asc = [...groups].sort((a, b) => a.date.localeCompare(b.date));
    const m: Record<string, number> = {};
    asc.forEach((g, i) => {
      m[g.date] = i + 1;
    });
    return m;
  }, [groups]);

  return (
    <div className="mt-6 flex flex-col gap-6">
      {groups.map((g) => (
        <DayGroupCard
          key={g.date}
          date={g.date}
          visits={g.visits}
          ordinal={dayOrdinalByDate[g.date] ?? 1}
          currentUserId={currentUserId}
          profilesByUser={profilesByUser}
          showChips={showChips}
          onPhotoClick={onPhotoClick}
        />
      ))}
    </div>
  );
}

function DayGroupCard({
  visits,
  ordinal,
  currentUserId,
  profilesByUser,
  showChips,
  onPhotoClick,
}: {
  date: string;
  visits: Visit[];
  ordinal: number;
  currentUserId: string | null;
  profilesByUser: Record<string, Profile>;
  showChips: boolean;
  onPhotoClick: (photos: VisitPhoto[], index: number) => void;
}) {
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);

  // Distinct creators in this day's visits, in first-seen order.
  const distinctCreators = useMemo(() => {
    const seen = new Set<string>();
    const out: { userId: string; name: string }[] = [];
    for (const v of visits) {
      if (!v.created_by || seen.has(v.created_by)) continue;
      seen.add(v.created_by);
      const p = profilesByUser[v.created_by];
      out.push({
        userId: v.created_by,
        name: p?.display_name ?? "Someone",
      });
    }
    return out;
  }, [visits, profilesByUser]);

  // All photos across all visits in this day, ordered by parent
  // visited_at then visit_photos.created_at.
  const photos = useMemo(() => {
    const flat: { photo: VisitPhoto; visitedAt: string }[] = [];
    for (const v of visits) {
      for (const p of v.visit_photos) {
        flat.push({ photo: p, visitedAt: v.visited_at });
      }
    }
    flat.sort((a, b) => {
      const t = a.visitedAt.localeCompare(b.visitedAt);
      if (t !== 0) return t;
      return a.photo.created_at.localeCompare(b.photo.created_at);
    });
    return flat.map((x) => x.photo);
  }, [visits]);

  const visitsWithNotes = visits.filter((v) => v.note?.trim());
  const editingVisit =
    editingVisitId != null
      ? visits.find((v) => v.id === editingVisitId) ?? null
      : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-soft">
            {ordinalTimeLabel(ordinal).toUpperCase()}
          </div>
          <div
            data-visit-date
            className="font-display italic text-[16px] leading-tight text-ink"
          >
            {formatLongDate(visits[0].visited_at)}
          </div>
        </div>
        <DayMenu
          visits={visits}
          currentUserId={currentUserId}
          profilesByUser={profilesByUser}
          onEditVisit={(id) => setEditingVisitId(id)}
        />
      </div>

      {showChips && distinctCreators.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {distinctCreators.map((c) => (
            <span
              key={c.userId}
              className="rounded-full bg-surface px-2 py-0.5 font-body italic text-[12px] text-ink"
              style={{ border: "0.5px solid var(--border)" }}
            >
              {c.name}
            </span>
          ))}
        </div>
      )}

      {editingVisit ? (
        <EditNoteInline
          visit={editingVisit}
          onDone={() => setEditingVisitId(null)}
        />
      ) : (
        visitsWithNotes.length > 0 && (
          <div className="flex flex-col gap-2">
            {visitsWithNotes.map((v) => (
              <p
                key={v.id}
                className="font-handwritten text-[16px] leading-snug text-ink"
                style={{
                  transform: "rotate(-1deg)",
                  transformOrigin: "left top",
                }}
              >
                {v.note}
              </p>
            ))}
          </div>
        )
      )}

      {photos.length > 0 && (
        <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPhotoClick(photos, i)}
              className="shrink-0 overflow-hidden rounded-lg"
              style={{ height: 80, width: 80 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.image_url}
                alt=""
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Day menu — list of underlying visits with per-row edit/delete
// ============================================================

function DayMenu({
  visits,
  currentUserId,
  profilesByUser,
  onEditVisit,
}: {
  visits: Visit[];
  currentUserId: string | null;
  profilesByUser: Record<string, Profile>;
  onEditVisit: (visitId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Optimistic visit deletion. Removes the visit from both the per-pin
  // and the all-visits caches synchronously, then fires the API. On
  // failure, both snapshots are restored.
  const deleteVisit = useMutation({
    mutationFn: async (visitId: string) => {
      const res = await fetch("/api/delete-visit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visitId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
    },
    onMutate: async (visitId: string) => {
      await queryClient.cancelQueries({ queryKey: ["visits"] });

      // Snapshot every visits-* query that might contain this row.
      const allVisitQueries = queryClient.getQueriesData<Visit[]>({
        queryKey: ["visits"],
      });

      for (const [key, data] of allVisitQueries) {
        if (!data) continue;
        // Per-pin queries hold Visit[]; the all-visits cache holds
        // VisitWithPin[]. Both are filtered the same way by id.
        queryClient.setQueryData(
          key,
          data.filter((v: Visit | VisitWithPin) => v.id !== visitId),
        );
      }

      return { snapshots: allVisitQueries };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.snapshots) return;
      for (const [key, data] of ctx.snapshots) {
        queryClient.setQueryData(key, data);
      }
      toast.error("Couldn't delete that visit — try again?");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({ queryKey: ["pins"] });
    },
  });

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Day options"
        className="px-2 text-lg leading-none tracking-widest text-ink-soft"
      >
        ···
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-10 mt-1 min-w-[220px] overflow-hidden rounded-lg bg-surface shadow-md"
          style={{ border: "1px solid var(--border)" }}
        >
          {visits.map((v, i) => {
            const creatorName = v.created_by
              ? profilesByUser[v.created_by]?.display_name
              : null;
            const isOwner =
              currentUserId != null && currentUserId === v.created_by;
            return (
              <div
                key={v.id}
                className={`px-3 py-2 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
                style={i > 0 ? { borderTop: "0.5px solid var(--border)" } : {}}
              >
                <div className="text-[11px] text-ink-soft">
                  Logged at {formatTimeOfDay(v.visited_at)}
                  {creatorName ? ` by ${creatorName}` : ""}
                </div>
                {isOwner ? (
                  <div className="mt-1 flex gap-3 text-[12px]">
                    <button
                      type="button"
                      onClick={() => {
                        onEditVisit(v.id);
                        setOpen(false);
                      }}
                      className="text-ink"
                    >
                      Edit note
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        deleteVisit.mutate(v.id);
                        setOpen(false);
                      }}
                      className="text-accent"
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <div className="mt-1 text-[11px] italic text-ink-soft">
                    only the logger can edit or delete
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EditNoteInline({
  visit,
  onDone,
}: {
  visit: Visit;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(visit.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("visits")
        .update({ note: text.trim() || null })
        .eq("id", visit.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="w-full resize-none rounded-lg bg-bg px-3 py-2 font-handwritten text-[16px] text-ink outline-none"
        style={{ border: "1px solid var(--border)" }}
        autoFocus
      />
      {error && <p className="text-xs text-accent">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDone}
          disabled={busy}
          className="h-9 flex-1 rounded-lg text-xs text-ink-soft disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="h-9 flex-1 rounded-lg bg-accent text-xs font-medium text-bg disabled:opacity-50"
        >
          {busy ? "saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Log-a-visit form  (with proper local previews + per-photo status)
// ============================================================

type PendingPhotoStatus = "idle" | "uploading" | "uploaded" | "failed";
interface PendingPhoto {
  file: File;
  previewUrl: string;
  id: string;
  status: PendingPhotoStatus;
}

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
]);
const ALLOWED_EXTS = new Set([
  "jpg",
  "jpeg",
  "png",
  "heic",
  "heif",
  "webp",
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PHOTOS = 10;

function isAllowedFile(file: File): boolean {
  if (file.type && ALLOWED_TYPES.has(file.type.toLowerCase())) return true;
  // Some browsers don't set MIME for HEIC. Fall back to extension.
  const ext = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return ext != null && ALLOWED_EXTS.has(ext);
}

function LogVisitForm({
  pinId,
  spaceId,
  onSaved,
  onCancel,
}: {
  pinId: string;
  spaceId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(todayStr);
  const [note, setNote] = useState("");
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // visit row id once it's been inserted on a partial-failure save —
  // lets retries upload to the same visit instead of creating duplicates.
  const [visitId, setVisitId] = useState<string | null>(null);

  // Keep latest pendingPhotos in a ref so the unmount cleanup can revoke
  // current URLs without putting pendingPhotos in the dependency array
  // (which would revoke valid URLs on every change).
  const photosRef = useRef<PendingPhoto[]>(pendingPhotos);
  useEffect(() => {
    photosRef.current = pendingPhotos;
  }, [pendingPhotos]);
  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []);

  function onFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";

    setValidationError(null);
    let firstError: string | null = null;

    setPendingPhotos((prev) => {
      const next = [...prev];
      for (const file of picked) {
        if (!isAllowedFile(file)) {
          firstError ??= "only photos work here — jpg, png, heic, webp";
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          firstError ??= "that one's a bit too big — try another";
          continue;
        }
        if (next.length >= MAX_PHOTOS) {
          firstError ??= `only ${MAX_PHOTOS} photos at a time`;
          break;
        }
        next.push({
          file,
          previewUrl: URL.createObjectURL(file),
          id: crypto.randomUUID(),
          status: "idle",
        });
      }
      return next;
    });

    if (firstError) setValidationError(firstError);
  }

  function removePhoto(id: string) {
    setPendingPhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo) URL.revokeObjectURL(photo.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  function setPhotoStatus(id: string, status: PendingPhotoStatus) {
    setPendingPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status } : p)),
    );
  }

  async function uploadOne(
    photo: PendingPhoto,
    targetVisitId: string,
  ): Promise<boolean> {
    setPhotoStatus(photo.id, "uploading");
    try {
      const supabase = createClient();
      const { url, publicId } = await uploadPhoto(photo.file);
      const { error: insertError } = await supabase
        .from("visit_photos")
        .insert({
          visit_id: targetVisitId,
          image_url: url,
          public_id: publicId,
        });
      if (insertError) throw insertError;
      setPhotoStatus(photo.id, "uploaded");
      return true;
    } catch {
      setPhotoStatus(photo.id, "failed");
      return false;
    }
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      // First save creates the visit row. Subsequent retries reuse it.
      let currentVisitId = visitId;
      if (!currentVisitId) {
        const visitedAt = new Date(`${date}T12:00:00`).toISOString();
        const { data: visit, error: visitError } = await supabase
          .from("visits")
          .insert({
            pin_id: pinId,
            space_id: spaceId,
            visited_at: visitedAt,
            note: note.trim() || null,
            created_by: user.id,
          })
          .select("id")
          .single();
        if (visitError) throw visitError;
        currentVisitId = (visit as { id: string }).id;
        setVisitId(currentVisitId);
        queryClient.invalidateQueries({ queryKey: ["visits"] });
        queryClient.invalidateQueries({ queryKey: ["pins"] });
      }

      // Upload everything not yet uploaded.
      const toUpload = pendingPhotos.filter((p) => p.status !== "uploaded");
      let failed = 0;
      for (const p of toUpload) {
        const ok = await uploadOne(p, currentVisitId);
        if (!ok) failed += 1;
      }

      queryClient.invalidateQueries({ queryKey: ["visits"] });

      if (failed === 0) {
        // Brief pause to show the green check before closing.
        setTimeout(() => {
          photosRef.current.forEach((p) =>
            URL.revokeObjectURL(p.previewUrl),
          );
          onSaved();
        }, 600);
      } else {
        setError(
          `${failed} photo${failed === 1 ? "" : "s"} couldn't upload — your visit was saved.`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRetry(id: string) {
    if (!visitId) return;
    const photo = pendingPhotos.find((p) => p.id === id);
    if (!photo) return;
    const ok = await uploadOne(photo, visitId);
    if (ok) {
      // Clear the day-level error if everything is now uploaded.
      const stillFailed = pendingPhotos.some(
        (p) => p.id !== id && p.status === "failed",
      );
      if (!stillFailed) setError(null);
    }
  }

  const canSave =
    !busy &&
    pendingPhotos.every((p) => p.status !== "uploading") &&
    // After a partial failure, "Lock it in" should re-enable so the user
    // can retry the still-failed photos via tap or by saving again.
    (visitId == null || pendingPhotos.some((p) => p.status !== "uploaded"));

  return (
    <div
      className="mt-4 flex flex-col gap-3 rounded-xl bg-surface p-4"
      style={{ border: "1px solid var(--border)" }}
    >
      <h3 className="font-display italic text-[18px] text-ink">
        When did we visit?
      </h3>

      <input
        type="date"
        value={date}
        max={todayStr}
        onChange={(e) => setDate(e.target.value)}
        disabled={visitId != null}
        className="h-11 w-full rounded-lg bg-bg px-3 text-base text-ink outline-none disabled:opacity-60"
        style={{ border: "1px solid var(--border)" }}
      />

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="anything you want to remember about this time"
        rows={3}
        disabled={visitId != null}
        className="w-full resize-none rounded-lg bg-bg px-3 py-2 font-handwritten text-[18px] text-ink outline-none placeholder:font-body placeholder:text-[14px] placeholder:text-ink-soft disabled:opacity-60"
        style={{ border: "1px solid var(--border)" }}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif,image/webp,image/*"
        multiple
        hidden
        onChange={onFilesPicked}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={busy || pendingPhotos.length >= MAX_PHOTOS}
        className="h-10 w-full rounded-lg bg-bg text-sm text-ink disabled:opacity-50"
        style={{ border: "1px solid var(--border)" }}
      >
        {pendingPhotos.length > 0
          ? `${pendingPhotos.length} photo${pendingPhotos.length === 1 ? "" : "s"} selected · add more`
          : "Add photos"}
      </button>

      {validationError && (
        <p
          className="font-handwritten text-[16px] text-accent"
          style={{ transform: "rotate(-1deg)", transformOrigin: "left top" }}
        >
          {validationError}
        </p>
      )}

      {pendingPhotos.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {pendingPhotos.map((p) => (
            <PendingPhotoThumb
              key={p.id}
              photo={p}
              busy={busy}
              onRemove={() => removePhoto(p.id)}
              onRetry={() => handleRetry(p.id)}
            />
          ))}
        </div>
      )}

      {error && <p className="text-xs text-accent">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="h-12 flex-1 rounded-lg text-sm text-ink-soft disabled:opacity-50"
          style={{ border: "1px solid var(--border)" }}
        >
          {visitId ? "Done" : "Cancel"}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="h-12 flex-[2] rounded-lg bg-accent font-display italic text-[16px] text-bg disabled:opacity-50"
        >
          {busy ? "Saving…" : visitId ? "Retry uploads" : "Lock it in"}
        </button>
      </div>
    </div>
  );
}

function PendingPhotoThumb({
  photo,
  busy,
  onRemove,
  onRetry,
}: {
  photo: PendingPhoto;
  busy: boolean;
  onRemove: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.previewUrl}
        alt=""
        className="h-full w-full object-cover"
      />

      {photo.status === "uploading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        </div>
      )}

      {photo.status === "uploaded" && (
        <div
          aria-label="Uploaded"
          className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-white"
          style={{ backgroundColor: "#5C7A6F" }}
        >
          ✓
        </div>
      )}

      {photo.status === "failed" && (
        <button
          type="button"
          onClick={onRetry}
          aria-label="Retry upload"
          title="couldn't upload — tap to retry"
          className="absolute right-1 top-1 h-3 w-3 rounded-full bg-accent shadow"
        />
      )}

      {photo.status === "idle" && !busy && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove"
          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-xs leading-none text-white"
        >
          ×
        </button>
      )}
    </div>
  );
}

