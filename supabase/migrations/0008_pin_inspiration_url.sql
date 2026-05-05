-- 0008_pin_inspiration_url.sql
-- Pins remember the inspiration link that sent the couple here — a
-- TikTok of the place, a YouTube tour, an Instagram post. The pin
-- detail view renders this as an Open-Graph preview card so the
-- thumbnail and title that hooked them in the first place stay
-- attached to the memory.
--
-- Nullable: most pins won't have one. RLS inherits the existing pins
-- policies (security_invoker view), so no policy changes needed.

alter table public.pins
  add column if not exists inspiration_url text;

-- Recreate pins_with_visit_count so `select p.*` picks up the new
-- column. CREATE OR REPLACE VIEW can't add a column in the middle of
-- the select list (only at the end), so drop + recreate is the safe
-- path here. Same pattern as 0007.
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
