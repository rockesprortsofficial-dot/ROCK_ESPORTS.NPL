-- REVIEWED SETUP REQUIRED. Additive; does not alter existing tables, storage or policies.
-- Run in a staging database first. This file has NOT been applied to production.
begin;
create schema if not exists rock_broadcast_private;
revoke all on schema rock_broadcast_private from public,anon;
grant usage on schema rock_broadcast_private to authenticated;
create table if not exists rock_broadcast_private.owners(user_id uuid primary key references auth.users(id));
revoke all on rock_broadcast_private.owners from public,anon,authenticated;
alter table rock_broadcast_private.owners enable row level security;
-- Resolve the existing verified owner account once. No user-editable metadata authorizes access.
insert into rock_broadcast_private.owners(user_id)
select id from auth.users where lower(email)='rockesprorts.official@gmail.com' and email_confirmed_at is not null
on conflict do nothing;
create or replace function rock_broadcast_private.is_owner() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from rock_broadcast_private.owners where user_id=auth.uid());
$$;
revoke all on function rock_broadcast_private.is_owner() from public,anon;
grant execute on function rock_broadcast_private.is_owner() to authenticated;
create table if not exists public.rock_broadcast_public(
 id integer primary key check(id=1),snapshot jsonb,revision bigint not null default 0,
 updated_at timestamptz not null default now(),check(octet_length(snapshot::text)<8000000));
insert into public.rock_broadcast_public(id) values(1) on conflict do nothing;
alter table public.rock_broadcast_public enable row level security;
revoke all on public.rock_broadcast_public from public,anon,authenticated;
grant select on public.rock_broadcast_public to anon,authenticated;
grant update(snapshot,revision,updated_at) on public.rock_broadcast_public to authenticated;
create policy broadcast_public_read on public.rock_broadcast_public for select to anon,authenticated using(true);
create policy broadcast_owner_publish on public.rock_broadcast_public for update to authenticated
using((select rock_broadcast_private.is_owner())) with check((select rock_broadcast_private.is_owner()));
create table if not exists public.rock_broadcast_matches(
 id uuid primary key default gen_random_uuid(),created_at timestamptz not null default now(),
 created_by uuid not null default auth.uid() references auth.users(id),snapshot jsonb not null,
 verified boolean not null default false,reason text not null check(length(trim(reason)) between 1 and 500),
 check(octet_length(snapshot::text)<8000000));
alter table public.rock_broadcast_matches enable row level security;
revoke all on public.rock_broadcast_matches from public,anon,authenticated;
grant select,insert on public.rock_broadcast_matches to authenticated;
create policy broadcast_history_read on public.rock_broadcast_matches for select to authenticated using((select rock_broadcast_private.is_owner()));
create policy broadcast_history_append on public.rock_broadcast_matches for insert to authenticated
with check((select rock_broadcast_private.is_owner()) and created_by=auth.uid());
-- History deliberately has no UPDATE or DELETE grant/policy. Corrections append new snapshots.
create or replace function public.rock_broadcast_publish(p_snapshot jsonb,p_revision bigint)
returns bigint language plpgsql security invoker set search_path='' as $$
declare result bigint; t jsonb; p jsonb;
begin
 if not rock_broadcast_private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
 if jsonb_array_length(p_snapshot->'teams')<>16 then raise exception '16 teams required';end if;
 for t in select value from jsonb_array_elements(p_snapshot->'teams') loop
  if jsonb_array_length(t->'players')<>4 then raise exception '4 players required';end if;
  for p in select value from jsonb_array_elements(t->'players') loop
   if p ?| array['pubg_uid','realName','phone_number','email','player_photo_path'] then raise exception 'Private player fields cannot be published';end if;
  end loop;
 end loop;
 update public.rock_broadcast_public set snapshot=p_snapshot,revision=revision+1,updated_at=now()
 where id=1 and revision=p_revision returning revision into result;
 if result is null then raise exception 'Broadcast changed in another session. Refresh before publishing.' using errcode='40001';end if;
 return result;
end $$;
revoke all on function public.rock_broadcast_publish(jsonb,bigint) from public,anon;
grant execute on function public.rock_broadcast_publish(jsonb,bigint) to authenticated;
commit;
