begin;
create table public.rock_gameplay_cohost_attempts (
 session_id uuid primary key references public.rock_broadcast_social_sessions(id) on delete cascade,
 window_start timestamptz not null,
 attempts integer not null
);
alter table public.rock_gameplay_cohost_attempts enable row level security;
revoke all on public.rock_gameplay_cohost_attempts from public, anon, authenticated;
grant select, insert, update on public.rock_gameplay_cohost_attempts to service_role;

create function public.rock_gameplay_cohost_attempt(p_session uuid)
returns boolean language sql security invoker set search_path='' as $$
 with accepted as (
  insert into public.rock_gameplay_cohost_attempts as a(session_id,window_start,attempts)
  select id,clock_timestamp(),1 from public.rock_broadcast_social_sessions
   where id=p_session and mode='gameplay' and join_open and not ended and expires_at>now()
  on conflict(session_id) do update set
   attempts=case when a.window_start<=clock_timestamp()-interval '1 minute' then 1 else a.attempts+1 end,
   window_start=case when a.window_start<=clock_timestamp()-interval '1 minute' then clock_timestamp() else a.window_start end
  where a.attempts<12 or a.window_start<=clock_timestamp()-interval '1 minute'
  returning 1
 )
 select exists(select 1 from accepted);
$$;
revoke execute on function public.rock_gameplay_cohost_attempt(uuid) from public, anon, authenticated;
grant execute on function public.rock_gameplay_cohost_attempt(uuid) to service_role;
commit;
