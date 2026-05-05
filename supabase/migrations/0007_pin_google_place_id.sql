-- 0007_pin_google_place_id.sql
-- Pins created via the Places search/preview flow remember which Google
-- place they came from. Used in the pin drawer's pre-lived state to
-- show Google's photos and reviews until the couple logs their first
-- visit and starts replacing them with their own memories.
--
-- Nullable: pins dropped by direct map-tap (no Places resolution) won't
-- have a place_id, and that's fine — the drawer just shows the standard
-- "We did it" empty state.

alter table public.pins
  add column if not exists google_place_id text;

-- Recreate pins_with_visit_count so `select p.*` picks up the new
-- column. CREATE OR REPLACE VIEW can't add a column in the middle of
-- the select list (only at the end), so drop + recreate is the safe
-- path here.
drop view if exists public.pins_with_visit_count;

create view public.pins_with_visit_count
with (security_invoker = on)
as
select
  p.*,
  coalesce(
    (
      select count(distinct date_trunc('day', v.visited_at))
        from public.visits v
       where v.pin_id = p.id
    ),
    0
  )::int as visit_day_count
from public.pins p;
