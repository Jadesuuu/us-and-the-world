// notify-pin-created
//
// Triggered by a Supabase database webhook on `pins` INSERT. Fans out
// a Web Push notification to every push_subscription belonging to a
// member of the pin's space, excluding the creator.
//
// Required Function secrets:
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT          mailto:you@example.com
//   PUSH_WEBHOOK_SECRET    arbitrary shared secret with the DB webhook
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected by the
// Edge Functions runtime.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface PinRow {
  id: string;
  title: string;
  space_id: string;
  created_by: string | null;
}

interface WebhookBody {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: PinRow;
}

Deno.serve(async (req: Request) => {
  // Shared-secret gate. Without this, anyone who finds the Function URL
  // could trigger pushes by POSTing fake bodies. The DB webhook config
  // sends the matching value via the configured header.
  const expectedSecret = getEnv("PUSH_WEBHOOK_SECRET");
  if (!expectedSecret) {
    return json({ error: "function not configured" }, 500);
  }
  if (req.headers.get("x-webhook-secret") !== expectedSecret) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: WebhookBody;
  try {
    body = (await req.json()) as WebhookBody;
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  if (body.type !== "INSERT" || body.table !== "pins") {
    return json({ skipped: true, reason: "not a pins INSERT" }, 200);
  }

  const pin = body.record;
  if (!pin?.id || !pin.space_id) {
    return json({ error: "missing pin fields" }, 400);
  }

  const supabase = createClient(
    getEnv("SUPABASE_URL")!,
    getEnv("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Recipients: other members of the same space.
  const { data: members, error: membersErr } = await supabase
    .from("space_members")
    .select("user_id")
    .eq("space_id", pin.space_id);
  if (membersErr) return json({ error: membersErr.message }, 500);

  const recipientIds = (members ?? [])
    .map((m: { user_id: string }) => m.user_id)
    .filter((id: string) => id !== pin.created_by);
  if (recipientIds.length === 0) {
    return json({ skipped: true, reason: "no recipients" }, 200);
  }

  const { data: subs, error: subsErr } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", recipientIds);
  if (subsErr) return json({ error: subsErr.message }, 500);
  if (!subs || subs.length === 0) {
    return json({ skipped: true, reason: "no subscriptions" }, 200);
  }

  // Sender's display name for the notification title. Falls back to
  // "Someone" if the profile row isn't there for any reason.
  let creatorName = "Someone";
  if (pin.created_by) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", pin.created_by)
      .maybeSingle();
    if (profile?.display_name) creatorName = profile.display_name;
  }

  webpush.setVapidDetails(
    getEnv("VAPID_SUBJECT")!,
    getEnv("VAPID_PUBLIC_KEY")!,
    getEnv("VAPID_PRIVATE_KEY")!,
  );

  const payload = JSON.stringify({
    title: `${creatorName} dropped a dream`,
    body: pin.title,
    pinId: pin.id,
  });

  type SubRow = {
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  };

  const results = await Promise.all(
    (subs as SubRow[]).map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 60 * 60 * 24 }, // hold for 24h if the device is offline
        );
        return { id: sub.id, ok: true };
      } catch (err) {
        const status =
          (err as { statusCode?: number })?.statusCode ?? 0;
        // 410 Gone / 404 Not Found = browser revoked or recreated.
        // Drop the row so we don't keep retrying a dead endpoint.
        if (status === 410 || status === 404) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
        }
        return {
          id: sub.id,
          ok: false,
          status,
          error: (err as Error).message,
        };
      }
    }),
  );

  return json({ sent: results.length, results }, 200);
});

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function getEnv(name: string): string | undefined {
  return Deno.env.get(name);
}
