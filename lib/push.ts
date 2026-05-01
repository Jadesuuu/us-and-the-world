"use client";

import { createClient } from "@/lib/supabase/client";

// Web Push subscription helpers. Wraps the browser's Push API +
// service-worker registration with the bits specific to this app:
// VAPID public key from env, persistence into Supabase, iOS quirks.

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export type PushSupport =
  | { supported: true }
  | {
      supported: false;
      // Why it's not supported, surfaced to the UI for a clearer
      // "Add to Home Screen first" hint on iOS.
      reason: "no-service-worker" | "no-push-api" | "ios-needs-pwa-install";
    };

export function checkPushSupport(): PushSupport {
  if (typeof window === "undefined") return { supported: false, reason: "no-service-worker" };
  if (!("serviceWorker" in navigator)) {
    return { supported: false, reason: "no-service-worker" };
  }
  if (!("PushManager" in window)) {
    // iOS Safari <16.4, or iOS Safari without a home-screen install.
    if (isIos() && !isStandalone()) {
      return { supported: false, reason: "ios-needs-pwa-install" };
    }
    return { supported: false, reason: "no-push-api" };
  }
  return { supported: true };
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  // /iPad|iPhone|iPod/ catches the obvious cases. iPadOS 13+ reports
  // as Macintosh — fall back to a touch-points check for that.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS sets standalone on navigator; Chrome uses display-mode media query.
  const navStandalone = (navigator as unknown as { standalone?: boolean })
    .standalone;
  if (navStandalone === true) return true;
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; ++i) bin += String.fromCharCode(bytes[i]);
  return btoa(bin)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getOrRegisterSW(): Promise<ServiceWorkerRegistration> {
  // navigator.serviceWorker.ready resolves when there's *any* active
  // SW. If we haven't registered yet, register first.
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

// Subscribe the current browser to push and persist the subscription
// row in Supabase. Returns true if a fresh permission grant succeeded;
// false if the user denied or the prompt was dismissed.
export async function subscribeToPush(): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY) {
    throw new Error(
      "NEXT_PUBLIC_VAPID_PUBLIC_KEY missing — generate one with `node scripts/generate-vapid-keys.mjs`",
    );
  }

  const support = checkPushSupport();
  if (!support.supported) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const reg = await getOrRegisterSW();
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    // Cast to BufferSource — TS's DOM lib types fight over Uint8Array's
    // ArrayBufferLike vs ArrayBuffer, but PushManager accepts either.
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      .buffer as ArrayBuffer,
  });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not signed in");

  const p256dh = arrayBufferToBase64Url(sub.getKey("p256dh"));
  const auth = arrayBufferToBase64Url(sub.getKey("auth"));

  // Upsert by endpoint — re-subscribing the same browser shouldn't
  // create duplicate rows. The unique index on endpoint enforces this.
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh,
        auth,
        user_agent:
          typeof navigator !== "undefined" ? navigator.userAgent : null,
      },
      { onConflict: "endpoint" },
    );
  if (error) throw error;

  return true;
}

// Unsubscribe this browser and delete its row. Idempotent — calling
// when not subscribed is a no-op.
export async function unsubscribeFromPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();

  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe();

    const supabase = createClient();
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint);
  }
}

// Has this browser already opted in? Used to seed the toggle.
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  return (await reg?.pushManager.getSubscription()) ?? null;
}
