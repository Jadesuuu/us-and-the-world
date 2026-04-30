-- 0005_pins_with_visit_count.sql
-- Convenience view that exposes visit_day_count alongside the pin row.
-- visit_day_count = the number of distinct calendar days (UTC) on which
-- this pin has at least one visit. Drives the marker's 3-state visual
-- (untouched / lived once / lived multiple).
--
-- security_invoker = on so the view runs as the calling user, which
-- means RLS on `pins` and `visits` applies normally. Without it, views
-- run as the owner and would bypass row-level filtering.

create or replace view public.pins_with_visit_count
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
