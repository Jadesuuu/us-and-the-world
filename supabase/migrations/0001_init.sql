-- 0001_init.sql
-- Initial schema: spaces, space_members, pins + RLS

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.spaces (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  created_at timestamptz not null default now()
);

create table if not exists public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id  uuid not null references auth.users(id)   on delete cascade,
  primary key (space_id, user_id)
);

create table if not exists public.pins (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references public.spaces(id) on delete cascade,
  title      text not null,
  note       text,
  lat        double precision,
  lng        double precision,
  is_done    boolean not null default false,
  done_at    timestamptz,
  memory     text,
  image_url  text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pins_space_id_idx        on public.pins(space_id);
create index if not exists space_members_user_idx   on public.space_members(user_id);

-- ============================================================
-- updated_at trigger for pins
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pins_set_updated_at on public.pins;
create trigger pins_set_updated_at
  before update on public.pins
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================

alter table public.spaces        enable row level security;
alter table public.space_members enable row level security;
alter table public.pins          enable row level security;

-- Helper: is the current user a member of the given space?
-- SECURITY DEFINER so the function's own query against space_members
-- does not re-trigger RLS (avoids recursion in the space_members policies).
create or replace function public.is_space_member(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.space_members
     where space_id = target_space_id
       and user_id  = auth.uid()
  );
$$;

revoke all on function public.is_space_member(uuid) from public;
grant execute on function public.is_space_member(uuid) to authenticated;

-- ---- spaces ------------------------------------------------
drop policy if exists "spaces select if member" on public.spaces;
create policy "spaces select if member"
  on public.spaces for select
  using (public.is_space_member(id));

drop policy if exists "spaces insert if member" on public.spaces;
create policy "spaces insert if member"
  on public.spaces for insert
  with check (public.is_space_member(id));

drop policy if exists "spaces update if member" on public.spaces;
create policy "spaces update if member"
  on public.spaces for update
  using (public.is_space_member(id))
  with check (public.is_space_member(id));

drop policy if exists "spaces delete if member" on public.spaces;
create policy "spaces delete if member"
  on public.spaces for delete
  using (public.is_space_member(id));

-- ---- space_members -----------------------------------------
drop policy if exists "space_members select if member" on public.space_members;
create policy "space_members select if member"
  on public.space_members for select
  using (public.is_space_member(space_id));

drop policy if exists "space_members insert if member" on public.space_members;
create policy "space_members insert if member"
  on public.space_members for insert
  with check (public.is_space_member(space_id));

drop policy if exists "space_members update if member" on public.space_members;
create policy "space_members update if member"
  on public.space_members for update
  using (public.is_space_member(space_id))
  with check (public.is_space_member(space_id));

drop policy if exists "space_members delete if member" on public.space_members;
create policy "space_members delete if member"
  on public.space_members for delete
  using (public.is_space_member(space_id));

-- ---- pins --------------------------------------------------
drop policy if exists "pins select if member" on public.pins;
create policy "pins select if member"
  on public.pins for select
  using (public.is_space_member(space_id));

drop policy if exists "pins insert if member" on public.pins;
create policy "pins insert if member"
  on public.pins for insert
  with check (public.is_space_member(space_id));

drop policy if exists "pins update if member" on public.pins;
create policy "pins update if member"
  on public.pins for update
  using (public.is_space_member(space_id))
  with check (public.is_space_member(space_id));

drop policy if exists "pins delete if member" on public.pins;
create policy "pins delete if member"
  on public.pins for delete
  using (public.is_space_member(space_id));

  create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "anyone in your space can see profiles"
  on profiles for select
  using (
    exists (
      select 1 from space_members sm1
      join space_members sm2 on sm1.space_id = sm2.space_id
      where sm1.user_id = auth.uid()
        and sm2.user_id = profiles.user_id
    )
  );

create policy "users can update their own profile"
  on profiles for update
  using (user_id = auth.uid());
