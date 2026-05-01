-- 0006_push_subscriptions.sql
-- Web Push subscriptions, one row per browser/device a user has
-- granted permission on. The trio (endpoint, p256dh, auth) is the
-- complete Web Push subscription per the W3C spec — the Edge Function
-- needs all three to send a notification.
--
-- A user may have multiple rows (laptop + phone). Toggling
-- notifications off deletes their rows.

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- An endpoint is globally unique per browser install. If the same row
-- comes back during a re-subscribe cycle, replace it instead of
-- duplicating.
create unique index if not exists push_subscriptions_endpoint_uniq
  on public.push_subscriptions(endpoint);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id);

-- ============================================================
-- RLS — users see/manage only their own subscription rows. The
-- Edge Function uses the service role key and bypasses RLS to
-- query partner subscriptions during fan-out.
-- ============================================================

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own
  on public.push_subscriptions
  for select
  using (auth.uid() = user_id);

drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own
  on public.push_subscriptions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own
  on public.push_subscriptions
  for delete
  using (auth.uid() = user_id);
