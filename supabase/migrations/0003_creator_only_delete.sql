-- 0003_creator_only_delete.sql
-- Tighten pin deletion: only the creator can delete their own pin,
-- not any space member.

drop policy if exists "pins delete if member" on public.pins;

create policy "pins delete only creator"
  on public.pins for delete
  using (created_by = auth.uid());
