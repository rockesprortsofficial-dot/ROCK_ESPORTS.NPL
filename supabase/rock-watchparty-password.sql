begin;
alter table public.rock_broadcast_social_sessions
 add column watchparty_password_required boolean not null default false;
create table public.rock_watchparty_password_attempts (
 session_id uuid not null references public.rock_broadcast_social_sessions(id) on delete cascade,
 member_id uuid not null,
 window_start timestamptz not null,
 attempts integer not null,
 primary key(session_id,member_id)
);
alter table public.rock_watchparty_password_attempts enable row level security;
revoke all on public.rock_watchparty_password_attempts from public,anon,authenticated;
grant select, insert, update on public.rock_watchparty_password_attempts to service_role;
create function public.rock_watchparty_password_attempt(p_session uuid,p_member uuid)
returns boolean language sql security invoker set search_path='' as $$
 with allowed as (
  insert into public.rock_watchparty_password_attempts as a(session_id,member_id,window_start,attempts)
  select id,p_member,clock_timestamp(),1 from public.rock_broadcast_social_sessions
   where id=p_session and mode='watchparty' and watchparty_password_required and join_open and not ended and expires_at>now()
  on conflict(session_id,member_id) do update set
   attempts=case when a.window_start<=clock_timestamp()-interval '1 minute' then 1 else a.attempts+1 end,
   window_start=case when a.window_start<=clock_timestamp()-interval '1 minute' then clock_timestamp() else a.window_start end
  where a.attempts<8 or a.window_start<=clock_timestamp()-interval '1 minute'
  returning 1
 )
 select exists(select 1 from allowed);
$$;
revoke execute on function public.rock_watchparty_password_attempt(uuid,uuid) from public,anon,authenticated;
grant execute on function public.rock_watchparty_password_attempt(uuid,uuid) to service_role;
commit;
