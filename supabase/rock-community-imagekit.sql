-- Idempotent publication of ImageKit uploads, without changing legacy media records.
create unique index if not exists rock_community_imagekit_media_unique
on public.rock_community_posts(media_path) where media_path like 'ik:%';
