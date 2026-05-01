// JF & The World — push notification service worker.
// Handles two events:
//   1. push           → render a notification with title + body
//   2. notificationclick → focus an open tab (or open one) at /?pin=<id>

self.addEventListener("install", () => {
  // Activate immediately on first install — no need to wait for a
  // navigation since we're only used for push.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { title: "JF & The World", body: event.data?.text() ?? "" };
  }

  const title = payload.title || "JF & The World";
  const body = payload.body || "";
  const pinId = payload.pinId || "";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { pinId },
      // Use a stable tag so multiple pushes about the same pin
      // collapse into one notification rather than stacking.
      tag: pinId ? `pin:${pinId}` : "jf-notification",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const pinId = event.notification.data?.pinId;
  const url = pinId ? `/?pin=${encodeURIComponent(pinId)}` : "/";

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Prefer focusing an existing tab on our origin and asking it to
      // route to the pin via postMessage — feels instant, no reload.
      const sameOrigin = all.find(
        (c) => new URL(c.url).origin === self.location.origin,
      );
      if (sameOrigin) {
        await sameOrigin.focus();
        if (pinId) {
          sameOrigin.postMessage({ type: "jf:select-pin", pinId });
        }
        return;
      }

      // No tab open → open a new one at the deep-link URL.
      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
