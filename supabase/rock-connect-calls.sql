-- Additive call signalling for authenticated room members only.
begin;
create table if not exists public.rock_connect_calls (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rock_connect_rooms(id) on delete cascade,
  initiated_by uuid not null references auth.users(id) on delete cascade,
  mode text not null check(mode in ('audio','video')),
  status text not null default 'ringing' check(status in ('ringing','accepted','ended')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '2 hours'
);
create index if not exists rock_connect_calls_room_created on public.rock_connect_calls(room_id,created_at desc);
create or replace function public.rock_connect_validate_call()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or new.initiated_by<>auth.uid() or not public.rock_connect_is_member(new.room_id,auth.uid()) then
    raise exception 'Room membership required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,937));
  if exists(select 1 from public.rock_connect_calls where initiated_by=auth.uid() and created_at>now()-interval '20 seconds') then
    raise exception 'Please wait before calling again';
  end if;
  new.created_at:=now();new.expires_at:=now()+interval '2 hours';new.status:='ringing';
  return new;
end $$;
drop trigger if exists rock_connect_call_validate on public.rock_connect_calls;
create trigger rock_connect_call_validate before insert on public.rock_connect_calls for each row execute function public.rock_connect_validate_call();
alter table public.rock_connect_calls enable row level security;
drop policy if exists rock_connect_calls_member_read on public.rock_connect_calls;
create policy rock_connect_calls_member_read on public.rock_connect_calls for select to authenticated using(public.rock_connect_is_member(room_id,auth.uid()));
drop policy if exists rock_connect_calls_member_insert on public.rock_connect_calls;
create policy rock_connect_calls_member_insert on public.rock_connect_calls for insert to authenticated with check(initiated_by=auth.uid() and public.rock_connect_is_member(room_id,auth.uid()));
drop policy if exists rock_connect_calls_member_update on public.rock_connect_calls;
create policy rock_connect_calls_member_update on public.rock_connect_calls for update to authenticated using(public.rock_connect_is_member(room_id,auth.uid())) with check(public.rock_connect_is_member(room_id,auth.uid()));
revoke all on public.rock_connect_calls from anon;
grant select,insert on public.rock_connect_calls to authenticated;
revoke update on public.rock_connect_calls from authenticated;
grant update(status) on public.rock_connect_calls to authenticated;
grant select on public.rock_connect_profiles,public.rock_connect_rooms,public.rock_connect_members,public.rock_connect_messages,public.rock_connect_reactions,public.rock_connect_receipts to authenticated;
grant update(display_name) on public.rock_connect_profiles to authenticated;
grant insert,delete on public.rock_connect_messages,public.rock_connect_reactions to authenticated;
grant insert on public.rock_connect_receipts to authenticated;
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    begin alter publication supabase_realtime add table public.rock_connect_calls; exception when duplicate_object then null; end;
  end if;
end $$;
commit;
