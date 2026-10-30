begin;
create table if not exists public.rock_member_device_sessions(
 id uuid primary key default gen_random_uuid(),member_id uuid not null references public.rock_meeting_members(id) on delete cascade,
 token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),device_hash text not null check(device_hash ~ '^[0-9a-f]{64}$'),credential_version text not null,
 created_at timestamptz not null default now(),last_seen_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '90 days',revoked_at timestamptz
);
create index if not exists rock_member_device_sessions_device on public.rock_member_device_sessions(device_hash);
alter table public.rock_member_device_sessions enable row level security;
revoke all on public.rock_member_device_sessions from anon,authenticated;
grant all on public.rock_member_device_sessions to service_role;
create table if not exists public.rock_call_push_deliveries(call_id uuid references public.rock_pm_calls(id) on delete cascade,endpoint_hash text not null,state text not null default 'pending' check(state in ('pending','sent','failed')),created_at timestamptz not null default now(),primary key(call_id,endpoint_hash));
alter table public.rock_call_push_deliveries enable row level security;
revoke all on public.rock_call_push_deliveries from anon,authenticated;
grant all on public.rock_call_push_deliveries to service_role;
create or replace function public.rock_call_push_targets(p_call uuid) returns table(endpoint text,p256dh text,auth text,endpoint_hash text) language sql security definer set search_path=public as $$
 select distinct d.endpoint,d.p256dh,d.auth,d.endpoint_hash from rock_pm_calls c
 join rock_pm_call_invites i on i.call_id=c.id and i.state='ringing'
 join rock_pm_members pm on pm.room_id=c.room_id and pm.member_id=i.member_id
 join rock_meeting_members m on m.id=i.member_id and m.is_active and m.team_slug='rock-esports'
 join rock_app_devices d on d.member_id=m.id and d.member_opt_in
 join rock_member_device_sessions s on s.member_id=m.id and s.device_hash=d.manage_hash and s.revoked_at is null and s.expires_at>now()
 and s.credential_version=encode(extensions.digest(m.login_code_hash||':'||m.password_hash,'sha256'),'hex')
 where c.id=p_call and c.status in ('ringing','active') and c.expires_at>now() and c.created_at>now()-interval '60 seconds' and c.caller_id<>m.id
 and exists(select 1 from rock_meeting_members caller where caller.id=c.caller_id and caller.is_active and caller.team_slug='rock-esports')
 and not exists(select 1 from rock_call_push_deliveries l where l.call_id=c.id and l.endpoint_hash=d.endpoint_hash)
 limit 100;
$$;
create or replace function public.rock_call_claim_push(p_call uuid,p_endpoint_hash text) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from rock_call_push_targets(p_call) t where t.endpoint_hash=p_endpoint_hash) then return false;end if;
 insert into rock_call_push_deliveries(call_id,endpoint_hash) values(p_call,p_endpoint_hash) on conflict do nothing;
 return found;
end $$;
create or replace function public.rock_member_revoke_device(p_token_hash text,p_device_hash text) returns boolean language plpgsql security definer set search_path=public as $$
declare affected uuid;
begin
 update rock_member_device_sessions set revoked_at=coalesce(revoked_at,now()) where token_hash=p_token_hash and device_hash=p_device_hash returning id into affected;
 if affected is null then return false;end if;
 update rock_member_device_sessions set revoked_at=coalesce(revoked_at,now()) where device_hash=p_device_hash;
 update rock_app_devices set member_id=null,member_opt_in=false,updated_at=now() where manage_hash=p_device_hash;
 return true;
end $$;
create or replace function public.rock_member_session_valid(p_id uuid,p_member uuid) returns boolean language sql security definer set search_path=public as $$
 select exists(select 1 from rock_member_device_sessions s join rock_meeting_members m on m.id=s.member_id where s.id=p_id and s.member_id=p_member and s.revoked_at is null and s.expires_at>now() and m.is_active and m.team_slug='rock-esports' and s.credential_version=encode(extensions.digest(m.login_code_hash||':'||m.password_hash,'sha256'),'hex'));
$$;
revoke all on function public.rock_call_push_targets(uuid),public.rock_call_claim_push(uuid,text),public.rock_member_revoke_device(text,text),public.rock_member_session_valid(uuid,uuid) from public,anon,authenticated;
grant execute on function public.rock_call_push_targets(uuid),public.rock_call_claim_push(uuid,text),public.rock_member_revoke_device(text,text),public.rock_member_session_valid(uuid,uuid) to service_role;
commit;
select 'Remembered member sessions and invited-device call routing installed' as verification;
