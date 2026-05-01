# Push notifications — first-time setup

You only run this once per environment (e.g., once for prod). After
that the toggle in Settings is the only thing you and Frances touch.

---

## 1. Generate a VAPID keypair

VAPID is the W3C standard for identifying your app to push services.
The keypair stays the same forever; if you ever rotate it, every
existing subscription is invalidated and users have to re-toggle.

```bash
node scripts/generate-vapid-keys.mjs
```

It prints three values. Copy them; the next two steps consume them.

## 2. Add the public key to `.env.local`

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<the public key the script printed>
```

Restart `npm run dev`. The browser uses this when subscribing.

## 3. Run the migration

```bash
# If you already use the Supabase dashboard SQL editor, paste the
# contents of supabase/migrations/0006_push_subscriptions.sql there
# and run it.

# If you use the Supabase CLI:
supabase db push
```

This creates the `push_subscriptions` table with RLS so each user
only sees their own rows.

## 4. Install the Supabase CLI (one time)

```bash
# macOS
brew install supabase/tap/supabase

# Windows (via Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Or use npx — works everywhere, no install
npx supabase --help
```

Verify:

```bash
supabase --version
```

Then link this project to your Supabase project:

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

`<your-project-ref>` is the slug in your Supabase dashboard URL —
e.g., `abcdefghijklmnop` from `https://supabase.com/dashboard/project/abcdefghijklmnop`.

## 5. Set Edge Function secrets

The function needs four secrets. The CLI sets them in one shot:

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY="<public key from step 1>" \
  VAPID_PRIVATE_KEY="<private key from step 1>" \
  VAPID_SUBJECT="mailto:jadesuuu@gmail.com" \
  PUSH_WEBHOOK_SECRET="<a long random string you make up>"
```

Generate the webhook secret however you like — `openssl rand -hex 32`,
1Password's generator, mash the keyboard. It just has to match in the
next step.

## 6. Deploy the function

```bash
supabase functions deploy notify-pin-created
```

You'll get a URL back like:

```
https://<project-ref>.supabase.co/functions/v1/notify-pin-created
```

## 7. Configure the database webhook

Supabase dashboard → **Database** → **Webhooks** → **Create a new hook**.

| Field        | Value                                                            |
|--------------|------------------------------------------------------------------|
| Name         | `notify-pin-created`                                             |
| Table        | `pins`                                                           |
| Events       | `Insert` (uncheck Update / Delete)                               |
| Type         | `Supabase Edge Functions`                                        |
| Edge Function| `notify-pin-created`                                             |
| HTTP Method  | `POST`                                                           |
| HTTP Headers | Add: `x-webhook-secret` = `<the PUSH_WEBHOOK_SECRET from step 5>`|

Save. Supabase does **not** retry failed webhooks; if a push misfires
once, it's gone — that's fine for casual notifications.

## 8. Try it

1. Open the app on your laptop. Settings → Notifications → toggle
   "New pin from your partner" on. Browser asks for permission. Allow.
2. Open the app on Frances's phone. Same toggle. (iOS: Add to Home
   Screen first; the app prompts you with the right hint.)
3. From your laptop, drop a pin. Frances's phone should buzz within
   a few seconds with: `Jade dropped a dream — <pin title>`.
4. Tap the notification. The app focuses and opens that pin.

If nothing happens, Supabase dashboard → **Edge Functions** →
`notify-pin-created` → **Logs** shows what fired and why.

---

## What lives where

| File                                                | Purpose                                              |
|-----------------------------------------------------|------------------------------------------------------|
| `supabase/migrations/0006_push_subscriptions.sql`   | Table + RLS policies                                 |
| `supabase/functions/notify-pin-created/index.ts`    | Server-side fan-out, called by the DB webhook        |
| `public/sw.js`                                      | Service worker, renders the notification + handles click |
| `lib/push.ts`                                       | Client-side subscribe / unsubscribe / iOS detection  |
| `components/SettingsDrawer.tsx`                     | The opt-in toggle (mobile drawer + desktop popover)  |
| `app/page.tsx`                                      | Wires the SW message + `?pin=<id>` deep link to map  |
| `scripts/generate-vapid-keys.mjs`                   | One-shot keypair generator (run once, ever)          |

## Common gotchas

- **iOS Safari needs PWA install.** If Frances tries to enable on iPhone in regular Safari, the toggle shows a hint to "Add to Home Screen" first. Web Push on iOS only works in standalone (installed) mode.
- **Permission denied is sticky.** If she taps Block on the permission prompt, future toggle attempts won't re-prompt — she has to clear the site permission in browser settings. The toggle surfaces the error.
- **Subscriptions go stale.** Browsers occasionally rotate endpoints. The Edge Function deletes any subscription that returns 410 Gone, so the next toggle-on regenerates a fresh row. Nothing for you to manage.
- **Local development.** `localhost` works for push (browsers treat it as secure context). But the Edge Function lives in Supabase's cloud, so the database webhook fires against the deployed function regardless of which client triggered the INSERT.
