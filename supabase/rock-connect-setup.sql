-- ROCK CONNECT: authenticated chat, media, reactions, receipts and private rooms.
create extension if not exists pgcrypto;

create table if not exists public.rock_connect_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  created_at timestamptz not null default now()
);

create table if not exists public.rock_connect_rooms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null check (kind in ('lobby','dm')),
  pair_key text unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

insert into public.rock_connect_rooms (id,title,kind)
values ('11111111-1111-4111-8111-111111111111','ROCK CONNECT Lobby','lobby')
on conflict (id) do nothing;

create table if not exists public.rock_connect_members (
  room_id uuid not null references public.rock_connect_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id,user_id)
);

create table if not exists public.rock_connect_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rock_connect_rooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  media_path text,
  media_type text check (media_type in ('image','video','audio')),
  reply_to uuid references public.rock_connect_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  check (char_length(trim(body)) > 0 or media_path is not null)
);

create index if not exists rock_connect_messages_room_created_idx
  on public.rock_connect_messages(room_id,created_at desc);

create table if not exists public.rock_connect_reactions (
  message_id uuid not null references public.rock_connect_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('👍','❤️','😂','🔥','🎮','🏆')),
  created_at timestamptz not null default now(),
  primary key (message_id,user_id,emoji)
);

create table if not exists public.rock_connect_receipts (
  message_id uuid not null references public.rock_connect_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (message_id,user_id)
);

create or replace function public.rock_connect_is_member(p_room uuid, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.rock_connect_members m where m.room_id=p_room and m.user_id=p_user) $$;
revoke all on function public.rock_connect_is_member(uuid,uuid) from public;
grant execute on function public.rock_connect_is_member(uuid,uuid) to authenticated;

create or replace function public.rock_connect_on_signup()
returns trigger language plpgsql security definer set search_path=public
as $$
declare v_name text;
begin
  v_name := left(trim(coalesce(new.raw_user_meta_data->>'display_name', 'खेलाडी', 'खेलाडी')),40);
  if char_length(v_name)<2 then v_name := 'खेलाडी'; end if;
  insert into public.rock_connect_profiles(user_id,display_name)
    values(new.id,v_name) on conflict(user_id) do nothing;
  insert into public.rock_connect_members(room_id,user_id)
    values('11111111-1111-4111-8111-111111111111',new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists rock_connect_auth_user_created on auth.users;
create trigger rock_connect_auth_user_created after insert on auth.users
for each row execute function public.rock_connect_on_signup();

insert into public.rock_connect_profiles(user_id,display_name)
select u.id, left(coalesce(nullif(trim(u.raw_user_meta_data->>'display_name'),''),'खेलाडी','खेलाडी'),40)
from auth.users u
on conflict(user_id) do nothing;
insert into public.rock_connect_members(room_id,user_id)
select '11111111-1111-4111-8111-111111111111',u.id from auth.users u
on conflict do nothing;

create or replace function public.rock_connect_create_dm(p_other_user uuid)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_me uuid := auth.uid(); v_key text; v_room uuid;
begin
  if v_me is null or p_other_user is null or v_me=p_other_user then
    raise exception 'Choose another signed-in player';
  end if;
  if not exists(select 1 from public.rock_connect_profiles where user_id=p_other_user) then
    raise exception 'Player not found';
  end if;
  v_key := least(v_me::text,p_other_user::text)||':'||greatest(v_me::text,p_other_user::text);
  insert into public.rock_connect_rooms(title,kind,pair_key,created_by)
    values('Private chat','dm',v_key,v_me)
    on conflict(pair_key) do update set pair_key=excluded.pair_key
    returning id into v_room;
  insert into public.rock_connect_members(room_id,user_id)
    values(v_room,v_me),(v_room,p_other_user) on conflict do nothing;
  return v_room;
end $$;
revoke all on function public.rock_connect_create_dm(uuid) from public;
grant execute on function public.rock_connect_create_dm(uuid) to authenticated;

alter table public.rock_connect_profiles enable row level security;
alter table public.rock_connect_rooms enable row level security;
alter table public.rock_connect_members enable row level security;
alter table public.rock_connect_messages enable row level security;
alter table public.rock_connect_reactions enable row level security;
alter table public.rock_connect_receipts enable row level security;

drop policy if exists rock_connect_profiles_read on public.rock_connect_profiles;
create policy rock_connect_profiles_read on public.rock_connect_profiles for select to authenticated using (auth.uid() is not null);
drop policy if exists rock_connect_profiles_update on public.rock_connect_profiles;
create policy rock_connect_profiles_update on public.rock_connect_profiles for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists rock_connect_rooms_read on public.rock_connect_rooms;
create policy rock_connect_rooms_read on public.rock_connect_rooms for select to authenticated
using (kind='lobby' or public.rock_connect_is_member(id,auth.uid()));

drop policy if exists rock_connect_members_read on public.rock_connect_members;
create policy rock_connect_members_read on public.rock_connect_members for select to authenticated
using (user_id=auth.uid() or public.rock_connect_is_member(room_id,auth.uid()));

drop policy if exists rock_connect_messages_read on public.rock_connect_messages;
create policy rock_connect_messages_read on public.rock_connect_messages for select to authenticated
using (public.rock_connect_is_member(room_id,auth.uid()));
drop policy if exists rock_connect_messages_insert on public.rock_connect_messages;
create policy rock_connect_messages_insert on public.rock_connect_messages for insert to authenticated
with check (sender_id=auth.uid() and public.rock_connect_is_member(room_id,auth.uid()));
drop policy if exists rock_connect_messages_delete on public.rock_connect_messages;
create policy rock_connect_messages_delete on public.rock_connect_messages for delete to authenticated
using (sender_id=auth.uid());

drop policy if exists rock_connect_reactions_read on public.rock_connect_reactions;
create policy rock_connect_reactions_read on public.rock_connect_reactions for select to authenticated
using (exists(select 1 from public.rock_connect_messages m where m.id=message_id and public.rock_connect_is_member(m.room_id,auth.uid())));
drop policy if exists rock_connect_reactions_write on public.rock_connect_reactions;
create policy rock_connect_reactions_write on public.rock_connect_reactions for all to authenticated
using (user_id=auth.uid() and exists(select 1 from public.rock_connect_messages m where m.id=message_id and public.rock_connect_is_member(m.room_id,auth.uid())))
with check (user_id=auth.uid() and exists(select 1 from public.rock_connect_messages m where m.id=message_id and public.rock_connect_is_member(m.room_id,auth.uid())));

drop policy if exists rock_connect_receipts_read on public.rock_connect_receipts;
create policy rock_connect_receipts_read on public.rock_connect_receipts for select to authenticated
using (user_id=auth.uid() or exists(select 1 from public.rock_connect_messages m where m.id=message_id and m.sender_id=auth.uid()));
drop policy if exists rock_connect_receipts_write on public.rock_connect_receipts;
create policy rock_connect_receipts_write on public.rock_connect_receipts for insert to authenticated
with check (user_id=auth.uid() and exists(select 1 from public.rock_connect_messages m where m.id=message_id and public.rock_connect_is_member(m.room_id,auth.uid())));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('rock-connect-media','rock-connect-media',false,26214400,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','audio/webm','audio/mp4','audio/ogg'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists rock_connect_media_read on storage.objects;
create policy rock_connect_media_read on storage.objects for select to authenticated
using (bucket_id='rock-connect-media' and exists(
  select 1 from public.rock_connect_members m
  where m.user_id=auth.uid() and m.room_id::text=split_part(name,'/',1)
));
drop policy if exists rock_connect_media_insert on storage.objects;
create policy rock_connect_media_insert on storage.objects for insert to authenticated
with check (bucket_id='rock-connect-media' and exists(
  select 1 from public.rock_connect_members m
  where m.user_id=auth.uid() and m.room_id::text=split_part(name,'/',1)
));
drop policy if exists rock_connect_media_delete on storage.objects;
create policy rock_connect_media_delete on storage.objects for delete to authenticated
using (bucket_id='rock-connect-media' and owner_id=auth.uid()::text);

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    begin alter publication supabase_realtime add table public.rock_connect_messages; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.rock_connect_reactions; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.rock_connect_receipts; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.rock_connect_members; exception when duplicate_object then null; end;
  end if;
end $$;
