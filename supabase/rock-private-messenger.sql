-- Private messenger data is accessible only through verified member backend calls.
create table if not exists public.rock_pm_rooms(id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('dm','group')),title text not null default '',dm_key text unique,created_by uuid not null references public.rock_meeting_members(id),created_at timestamptz not null default now());
create table if not exists public.rock_pm_members(room_id uuid references public.rock_pm_rooms(id) on delete cascade,member_id uuid references public.rock_meeting_members(id),last_read_at timestamptz not null default now(),typing_until timestamptz,primary key(room_id,member_id));
create table if not exists public.rock_pm_messages(id uuid primary key default gen_random_uuid(),room_id uuid not null references public.rock_pm_rooms(id) on delete cascade,sender_id uuid not null references public.rock_meeting_members(id),body text not null default '' check(char_length(body)<=2000),media_path text,media_type text,reply_id uuid references public.rock_pm_messages(id),created_at timestamptz not null default now(),check(body<>'' or media_path is not null));
create index if not exists rock_pm_messages_room_time on public.rock_pm_messages(room_id,created_at desc);
create table if not exists public.rock_pm_reactions(message_id uuid references public.rock_pm_messages(id) on delete cascade,member_id uuid references public.rock_meeting_members(id),emoji text not null check(emoji in ('👍','❤️','😂','😮','😢','🔥')),primary key(message_id,member_id));
create table if not exists public.rock_pm_calls(id uuid primary key default gen_random_uuid(),room_id uuid not null references public.rock_pm_rooms(id),caller_id uuid not null references public.rock_meeting_members(id),mode text not null check(mode in ('audio','video')),status text not null default 'ringing' check(status in ('ringing','active','ended')),created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '60 seconds');
create unique index if not exists rock_pm_one_call on public.rock_pm_calls(room_id) where status in ('ringing','active');
create table if not exists public.rock_pm_call_invites(call_id uuid references public.rock_pm_calls(id) on delete cascade,member_id uuid references public.rock_meeting_members(id),state text not null default 'ringing' check(state in ('ringing','accepted','declined')),primary key(call_id,member_id));
alter table public.rock_pm_rooms enable row level security;
alter table public.rock_pm_members enable row level security;
alter table public.rock_pm_messages enable row level security;
alter table public.rock_pm_reactions enable row level security;
alter table public.rock_pm_calls enable row level security;
alter table public.rock_pm_call_invites enable row level security;
revoke all on public.rock_pm_rooms,public.rock_pm_members,public.rock_pm_messages,public.rock_pm_reactions,public.rock_pm_calls,public.rock_pm_call_invites from anon,authenticated;
create or replace function public.rock_pm_create_room(p_actor uuid,p_people uuid[],p_title text default '') returns uuid language plpgsql security definer set search_path=public as $$
declare people uuid[]; result uuid; dm text; room_kind text;
begin
select array_agg(distinct x order by x) into people from unnest(array_append(p_people,p_actor)) x;
if cardinality(people)<2 or cardinality(people)>50 then raise exception 'Choose 1 to 49 other members'; end if;
if (select count(*) from rock_meeting_members where id=any(people) and team_slug='rock-esports' and is_active)=cardinality(people) then null; else raise exception 'Active members only'; end if;
room_kind:=case when cardinality(people)=2 and trim(p_title)='' then 'dm' else 'group' end;
if room_kind='dm' then dm:=array_to_string(people,':'); insert into rock_pm_rooms(kind,dm_key,created_by) values('dm',dm,p_actor) on conflict(dm_key) do update set dm_key=excluded.dm_key returning id into result;
else if length(trim(p_title))<1 or length(p_title)>60 then raise exception 'Group name is required (60 characters maximum)'; end if; insert into rock_pm_rooms(kind,title,created_by) values('group',trim(p_title),p_actor) returning id into result; end if;
insert into rock_pm_members(room_id,member_id) select result,x from unnest(people) x on conflict do nothing; return result;
end $$;
revoke all on function public.rock_pm_create_room(uuid,uuid[],text) from public,anon,authenticated;
grant execute on function public.rock_pm_create_room(uuid,uuid[],text) to service_role;
grant all on public.rock_pm_rooms,public.rock_pm_members,public.rock_pm_messages,public.rock_pm_reactions,public.rock_pm_calls,public.rock_pm_call_invites to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('rock-private-messenger-media','rock-private-messenger-media',false,26214400,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','audio/webm','audio/ogg','audio/mp4']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
