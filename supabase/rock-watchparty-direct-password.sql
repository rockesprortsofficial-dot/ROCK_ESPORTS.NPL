begin;
create or replace function public.rock_watchparty_password_attempt(p_session uuid,p_member uuid)
returns boolean language sql security invoker set search_path='' as $$
 with allowed as (
  insert into public.rock_watchparty_password_attempts as a(session_id,member_id,window_start,attempts)
  select id,p_member,clock_timestamp(),1 from public.rock_broadcast_social_sessions
   where id=p_session and mode='watchparty' and watchparty_password_required and join_open and not ended and expires_at>now()
  on conflict(session_id,member_id) do update set
   attempts=case when a.window_start<=clock_timestamp()-interval '1 minute' then 1 else a.attempts+1 end,
   window_start=case when a.window_start<=clock_timestamp()-interval '1 minute' then clock_timestamp() else a.window_start end
  where a.attempts<(case when p_session=p_member then 60 else 8 end) or a.window_start<=clock_timestamp()-interval '1 minute'
  returning 1
 )
 select exists(select 1 from allowed);
$$;
commit;
