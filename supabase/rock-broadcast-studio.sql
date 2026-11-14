-- Stage after rock-live-broadcast.sql. Not applied to production.
begin;
create or replace function public.rock_broadcast_is_owner() returns boolean
language sql stable security invoker set search_path='' as $$select rock_broadcast_private.is_owner()$$;
revoke all on function public.rock_broadcast_is_owner() from public,anon;
grant execute on function public.rock_broadcast_is_owner() to authenticated;
create table public.rock_broadcast_studios(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '6 hours',
 invite_hash text not null,cohost_enabled boolean not null default true,studio_generation integer not null default 0,ended boolean not null default false,
 live boolean not null default false,egress_id text,egress_state text not null default 'idle',
 check(length(invite_hash)=64));
-- A single active studio prevents accidentally broadcasting the wrong game/host pair.
create unique index rock_broadcast_one_active_studio on public.rock_broadcast_studios((true)) where not ended;
alter table public.rock_broadcast_studios enable row level security;
revoke all on public.rock_broadcast_studios from public,anon,authenticated;
-- Only the dedicated server function accesses invitation hashes/session state.
grant select,insert,update on public.rock_broadcast_studios to service_role;
commit;
