-- 0004_multi_visit.sql
-- Pins are places. Visits are individual trips with their own dates,
-- notes, and photo sets. A pin can have many visits.

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.visits (
  id          uuid primary key default gen_random_uuid(),
  pin_id      uuid not null references public.pins(id) on delete cascade,
  space_id    uuid not null references public.spaces(id) on delete cascade,
  visited_at  timestamptz not null default now(),
  note        text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists visits_pin_id_idx
  on public.visits(pin_id);
create index if not exists visits_space_id_visited_at_idx
  on public.visits(space_id, visited_at desc);

create table if not exists public.visit_photos (
  id           uuid primary key default gen_random_uuid(),
  visit_id     uuid not null references public.visits(id) on delete cascade,
  image_url    text not null,
  public_id    text,
  created_at   timestamptz not null default now()
);

create index if not exists visit_photos_visit_id_idx
  on public.visit_photos(visit_id);

-- ============================================================
-- RLS
-- ============================================================

alter table public.visits        enable row level security;
alter table public.visit_photos  enable row level security;

drop policy if exists "visits select if member" on public.visits;
create policy "visits select if member"
  on public.visits for select
  using (public.is_space_member(space_id));

drop policy if exists "visits insert if member" on public.visits;
create policy "visits insert if member"
  on public.visits for insert
  with check (
    public.is_space_member(space_id)
    and created_by = auth.uid()
  );

drop policy if exists "visits update own" on public.visits;
create policy "visits update own"
  on public.visits for update
  using (created_by = auth.uid());

drop policy if exists "visits delete own" on public.visits;
create policy "visits delete own"
  on public.visits for delete
  using (created_by = auth.uid());

drop policy if exists "visit_photos select if member" on public.visit_photos;
create policy "visit_photos select if member"
  on public.visit_photos for select
  using (
    exists (
      select 1 from public.visits v
       where v.id = visit_photos.visit_id
         and public.is_space_member(v.space_id)
    )
  );

drop policy if exists "visit_photos insert if member" on public.visit_photos;
create policy "visit_photos insert if member"
  on public.visit_photos for insert
  with check (
    exists (
      select 1 from public.visits v
       where v.id = visit_photos.visit_id
         and public.is_space_member(v.space_id)
    )
  );

drop policy if exists "visit_photos delete if member" on public.visit_photos;
create policy "visit_photos delete if member"
  on public.visit_photos for delete
  using (
    exists (
      select 1 from public.visits v
       where v.id = visit_photos.visit_id
         and public.is_space_member(v.space_id)
    )
  );

-- ============================================================
-- Backfill from existing pins (only those marked done)
-- Skip pins already migrated to avoid duplicating visits on re-run.
-- ============================================================

insert into public.visits (pin_id, space_id, visited_at, note, created_by, created_at)
select p.id,
       p.space_id,
       coalesce(p.done_at, now()),
       p.memory,
       p.created_by,
       coalesce(p.done_at, p.created_at)
  from public.pins p
 where p.is_done = true
   and not exists (
         select 1 from public.visits v where v.pin_id = p.id
       );

-- Our pins.image_urls is text[] (migration 0002 replaced the original
-- image_url column). Expand the array into one row per photo.
insert into public.visit_photos (visit_id, image_url)
select v.id,
       url
  from public.pins p
  join public.visits v on v.pin_id = p.id
  cross join lateral unnest(p.image_urls) as url
 where p.image_urls is not null
   and array_length(p.image_urls, 1) > 0
   and not exists (
         select 1 from public.visit_photos vp
          where vp.visit_id = v.id and vp.image_url = url
       );

-- Realtime: add the new tables to the supabase_realtime publication so
-- the client can subscribe to changes. Wrapped in DO blocks because
-- ALTER PUBLICATION fails if the table is already a member.
do $$
begin
  alter publication supabase_realtime add table public.visits;
exception when duplicate_object then null;
end$$;

do $$
begin
  alter publication supabase_realtime add table public.visit_photos;
exception when duplicate_object then null;
end$$;

-- Don't drop the old columns yet — keep them as a safety net for one
-- release. Run these manually after confirming the new flow works:
--   alter table public.pins drop column done_at;
--   alter table public.pins drop column memory;
--   alter table public.pins drop column image_urls;
-- (note: in our schema the column is image_urls, not image_url)
