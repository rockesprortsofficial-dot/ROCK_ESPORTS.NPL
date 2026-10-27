-- ROCK ESPORTS public community feed
-- Posts are readable without an account. Writing, liking, commenting and reporting require a Supabase Auth account.
create extension if not exists pgcrypto;

create table if not exists public.rock_community_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create or replace function public.rock_community_create_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare chosen_name text;
begin
  chosen_name := left(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), 40);
  if chosen_name = '' then chosen_name := left(split_part(coalesce(new.email, 'Gamer'), '@', 1), 40); end if;
  insert into public.rock_community_profiles(user_id, display_name)
  values (new.id, chosen_name)
  on conflict (user_id) do update set display_name = excluded.display_name;
  return new;
end;
$$;

drop trigger if exists rock_community_auth_profile on auth.users;
create trigger rock_community_auth_profile after insert or update of raw_user_meta_data on auth.users
for each row execute function public.rock_community_create_profile();

create table if not exists public.rock_community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default '',
  content text not null default '',
  media_path text,
  media_type text check (media_type in ('image','video') or media_type is null),
  status text not null default 'published' check (status in ('published','hidden')),
  like_count integer not null default 0,
  comment_count integer not null default 0,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint rock_community_posts_content check (char_length(content) <= 2000 and (length(trim(content)) > 0 or media_path is not null))
);
create index if not exists rock_community_posts_feed_idx on public.rock_community_posts(status, created_at desc);

create or replace function public.rock_community_set_post_author()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select display_name into new.author_name from public.rock_community_profiles where user_id = new.author_id;
  if new.author_name is null or new.author_name = '' then new.author_name := 'ROCK ESPORTS gamer'; end if;
  return new;
end;
$$;
drop trigger if exists rock_community_post_author on public.rock_community_posts;
create trigger rock_community_post_author before insert on public.rock_community_posts
for each row execute function public.rock_community_set_post_author();

create table if not exists public.rock_community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.rock_community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default '',
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists rock_community_comments_post_idx on public.rock_community_comments(post_id, created_at);

create or replace function public.rock_community_set_comment_author()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select display_name into new.author_name from public.rock_community_profiles where user_id = new.author_id;
  if new.author_name is null or new.author_name = '' then new.author_name := 'ROCK ESPORTS gamer'; end if;
  return new;
end;
$$;
drop trigger if exists rock_community_comment_author on public.rock_community_comments;
create trigger rock_community_comment_author before insert on public.rock_community_comments
for each row execute function public.rock_community_set_comment_author();

create table if not exists public.rock_community_likes (
  post_id uuid not null references public.rock_community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create or replace function public.rock_community_update_like_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update public.rock_community_posts set like_count = like_count + 1 where id = new.post_id; return new;
  else update public.rock_community_posts set like_count = greatest(0, like_count - 1) where id = old.post_id; return old; end if;
end;
$$;
drop trigger if exists rock_community_like_count on public.rock_community_likes;
create trigger rock_community_like_count after insert or delete on public.rock_community_likes
for each row execute function public.rock_community_update_like_count();

create or replace function public.rock_community_update_comment_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update public.rock_community_posts set comment_count = comment_count + 1 where id = new.post_id; return new;
  else update public.rock_community_posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id; return old; end if;
end;
$$;
drop trigger if exists rock_community_comment_count on public.rock_community_comments;
create trigger rock_community_comment_count after insert or delete on public.rock_community_comments
for each row execute function public.rock_community_update_comment_count();

create table if not exists public.rock_community_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.rock_community_posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  unique(post_id, reporter_id)
);

create table if not exists public.rock_community_views (
  post_id uuid not null references public.rock_community_posts(id) on delete cascade,
  viewer_key text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, viewer_key)
);
alter table public.rock_community_views enable row level security;

create or replace function public.rock_community_record_view(p_post_id uuid, p_viewer_key text)
returns integer language plpgsql security definer set search_path = public as $$
declare current_views integer;
begin
  if p_viewer_key is null or length(p_viewer_key) < 16 or length(p_viewer_key) > 100 then return 0; end if;
  insert into public.rock_community_views(post_id, viewer_key) values (p_post_id, p_viewer_key) on conflict do nothing;
  if found then update public.rock_community_posts set view_count = view_count + 1 where id = p_post_id and status = 'published'; end if;
  select view_count into current_views from public.rock_community_posts where id = p_post_id;
  return coalesce(current_views, 0);
end;
$$;
grant execute on function public.rock_community_record_view(uuid,text) to anon, authenticated;

alter table public.rock_community_profiles enable row level security;
alter table public.rock_community_posts enable row level security;
alter table public.rock_community_comments enable row level security;
alter table public.rock_community_likes enable row level security;
alter table public.rock_community_reports enable row level security;

drop policy if exists rock_community_profiles_public_read on public.rock_community_profiles;
create policy rock_community_profiles_public_read on public.rock_community_profiles for select to anon, authenticated using (true);
drop policy if exists rock_community_profiles_self_update on public.rock_community_profiles;
create policy rock_community_profiles_self_update on public.rock_community_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists rock_community_posts_public_read on public.rock_community_posts;
create policy rock_community_posts_public_read on public.rock_community_posts for select to anon, authenticated using (status = 'published' or (auth.jwt()->>'email' = 'rockesprorts.official@gmail.com'));
drop policy if exists rock_community_posts_auth_insert on public.rock_community_posts;
create policy rock_community_posts_auth_insert on public.rock_community_posts for insert to authenticated with check (author_id = auth.uid() and status = 'published');
drop policy if exists rock_community_posts_owner_update on public.rock_community_posts;
create policy rock_community_posts_owner_update on public.rock_community_posts for update to authenticated using (auth.jwt()->>'email' = 'rockesprorts.official@gmail.com') with check (auth.jwt()->>'email' = 'rockesprorts.official@gmail.com');
drop policy if exists rock_community_posts_self_delete on public.rock_community_posts;
create policy rock_community_posts_self_delete on public.rock_community_posts for delete to authenticated using (author_id = auth.uid() or auth.jwt()->>'email' = 'rockesprorts.official@gmail.com');

drop policy if exists rock_community_comments_public_read on public.rock_community_comments;
create policy rock_community_comments_public_read on public.rock_community_comments for select to anon, authenticated using (true);
drop policy if exists rock_community_comments_auth_insert on public.rock_community_comments;
create policy rock_community_comments_auth_insert on public.rock_community_comments for insert to authenticated with check (author_id = auth.uid());
drop policy if exists rock_community_comments_owner_delete on public.rock_community_comments;
create policy rock_community_comments_owner_delete on public.rock_community_comments for delete to authenticated using (auth.jwt()->>'email' = 'rockesprorts.official@gmail.com' or author_id = auth.uid());

drop policy if exists rock_community_likes_public_read on public.rock_community_likes;
drop policy if exists rock_community_likes_self_read on public.rock_community_likes;
create policy rock_community_likes_self_read on public.rock_community_likes for select to authenticated using (user_id = auth.uid());
drop policy if exists rock_community_likes_self_insert on public.rock_community_likes;
create policy rock_community_likes_self_insert on public.rock_community_likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists rock_community_likes_self_delete on public.rock_community_likes;
create policy rock_community_likes_self_delete on public.rock_community_likes for delete to authenticated using (user_id = auth.uid());

drop policy if exists rock_community_reports_auth_insert on public.rock_community_reports;
create policy rock_community_reports_auth_insert on public.rock_community_reports for insert to authenticated with check (reporter_id = auth.uid());
drop policy if exists rock_community_reports_owner_read on public.rock_community_reports;
create policy rock_community_reports_owner_read on public.rock_community_reports for select to authenticated using (auth.jwt()->>'email' = 'rockesprorts.official@gmail.com');

grant select on public.rock_community_profiles, public.rock_community_posts, public.rock_community_comments to anon, authenticated;
grant insert, update on public.rock_community_profiles to authenticated;
grant insert, update, delete on public.rock_community_posts to authenticated;
grant insert, delete on public.rock_community_comments to authenticated;
grant select, insert, delete on public.rock_community_likes to authenticated;
grant insert, select on public.rock_community_reports to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rock-community-media','rock-community-media',true,26214400,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists rock_community_media_public_read on storage.objects;
create policy rock_community_media_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'rock-community-media');
drop policy if exists rock_community_media_owner_upload on storage.objects;
create policy rock_community_media_owner_upload on storage.objects for insert to authenticated with check (bucket_id = 'rock-community-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists rock_community_media_owner_delete on storage.objects;
create policy rock_community_media_owner_delete on storage.objects for delete to authenticated using (bucket_id = 'rock-community-media' and ((storage.foldername(name))[1] = auth.uid()::text or auth.jwt()->>'email' = 'rockesprorts.official@gmail.com'));

