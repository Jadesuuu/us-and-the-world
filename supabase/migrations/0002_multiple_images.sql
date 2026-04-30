-- 0002_multiple_images.sql
-- Replace single image_url with an image_urls text[] array.

alter table public.pins
  add column if not exists image_urls text[] not null default '{}';

-- Backfill any existing single-image pins. Idempotent: only runs on rows
-- where image_urls is still empty.
update public.pins
   set image_urls = array[image_url]
 where image_url is not null
   and (array_length(image_urls, 1) is null);

alter table public.pins drop column if exists image_url;
