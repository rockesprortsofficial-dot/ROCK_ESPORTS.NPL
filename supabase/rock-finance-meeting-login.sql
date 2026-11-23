begin;

create table rock_winners_private.meeting_finance_editor (
  singleton boolean primary key default true check (singleton),
  member_id uuid not null unique references public.rock_meeting_members(id),
  login_email text not null unique default (gen_random_uuid() || '@meeting.rock-esports.invalid'),
  editor_id uuid unique references auth.users(id)
);
alter table rock_winners_private.meeting_finance_editor enable row level security;

create table rock_winners_private.meeting_finance_sessions (
  id uuid primary key,
  editor_id uuid not null references auth.users(id),
  member_id uuid not null references public.rock_meeting_members(id),
  credential_hash text not null,
  expires_at timestamptz not null default (now() + interval '2 hours')
);
alter table rock_winners_private.meeting_finance_sessions enable row level security;

create function public.rock_finance_meeting_identity(member_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('email', b.login_email,
    'user_id', b.editor_id)
  from rock_winners_private.meeting_finance_editor b
  join public.rock_meeting_members m on m.id = b.member_id
  where b.member_id = $1 and m.is_active;
$$;
revoke all on function public.rock_finance_meeting_identity(uuid) from public, anon, authenticated;
grant execute on function public.rock_finance_meeting_identity(uuid) to service_role;

create function public.rock_finance_register_meeting_session(member_id uuid, editor_id uuid, session_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update rock_winners_private.meeting_finance_editor b set editor_id = $2
  where b.member_id = $1 and (b.editor_id is null or b.editor_id = $2)
    and exists (select 1 from auth.users u where u.id = $2
      and u.email = b.login_email);
  if not found then raise exception 'Finance identity unavailable'; end if;

  insert into rock_winners_private.meeting_finance_sessions(id, editor_id, member_id, credential_hash)
  select $3, $2, m.id, md5(m.login_code_hash || ':' || m.password_hash)
  from public.rock_meeting_members m
  join rock_winners_private.meeting_finance_editor b on b.member_id = m.id
  where m.id = $1 and m.is_active;
  if not found then raise exception 'Finance editor unavailable'; end if;

  delete from rock_winners_private.meeting_finance_sessions where expires_at <= now();
end;
$$;
revoke all on function public.rock_finance_register_meeting_session(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.rock_finance_register_meeting_session(uuid, uuid, uuid) to service_role;

create function rock_winners_private.meeting_finance_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from rock_winners_private.meeting_finance_sessions s
    join rock_winners_private.meeting_finance_editor b on b.member_id = s.member_id and b.editor_id = s.editor_id
    join public.rock_meeting_members m on m.id = s.member_id
    where s.id::text = auth.jwt()->>'session_id' and s.editor_id = auth.uid()
      and s.expires_at > now() and m.is_active
      and s.credential_hash = md5(m.login_code_hash || ':' || m.password_hash)
  );
$$;
revoke all on function rock_winners_private.meeting_finance_access() from public, anon;
grant execute on function rock_winners_private.meeting_finance_access() to authenticated;

create or replace function public.rock_winners_can_edit() returns boolean
language sql stable security invoker set search_path = '' as $$
  select auth.uid() is not null and (
    coalesce(auth.jwt()->>'email', '') = 'rockesprorts.official@gmail.com'
    or rock_winners_private.meeting_finance_access()
  );
$$;

commit;
