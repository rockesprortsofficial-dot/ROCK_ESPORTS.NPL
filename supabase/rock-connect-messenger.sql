-- Apply after rock-connect-setup.sql, rock-connect-calls.sql and rock-app-notifications.sql.
begin;
create extension if not exists pg_net;
alter table public.rock_app_devices add column if not exists connect_user_id uuid references auth.users(id) on delete set null;
create index if not exists rock_app_devices_connect_user on public.rock_app_devices(connect_user_id) where connect_user_id is not null;
grant select on public.rock_connect_rooms,public.rock_connect_members,public.rock_connect_messages,public.rock_connect_calls to service_role;

create or replace function public.rock_connect_link_device(p_endpoint text,p_hash text,p_key text,p_auth text,p_user uuid)
returns boolean language plpgsql set search_path=public as $$
begin
  insert into public.rock_app_devices as d(endpoint,manage_hash,p256dh,auth,public_opt_in,connect_user_id)
    values(p_endpoint,p_hash,p_key,p_auth,false,p_user)
    on conflict(endpoint) do update set connect_user_id=excluded.connect_user_id,
      p256dh=excluded.p256dh,auth=excluded.auth,updated_at=now()
    where d.manage_hash=excluded.manage_hash;
  return found;
end $$;
revoke all on function public.rock_connect_link_device(text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.rock_connect_link_device(text,text,text,text,uuid) to service_role;

alter table public.rock_connect_rooms drop constraint if exists rock_connect_rooms_kind_check;
alter table public.rock_connect_rooms add constraint rock_connect_rooms_kind_check check(kind in ('lobby','dm','group'));

create or replace function public.rock_connect_create_group(p_title text,p_users uuid[])
returns uuid language plpgsql security definer set search_path=public as $$
declare me uuid := auth.uid(); room uuid; member_count int;
begin
  if me is null or coalesce(char_length(trim(p_title)),0) not between 2 and 60
    or coalesce(cardinality(p_users),0) not between 2 and 20 then
    raise exception 'Choose a group name and 2–20 other players';
  end if;
  select count(*) into member_count from public.rock_connect_profiles where user_id=any(p_users) and user_id<>me;
  if member_count<>cardinality(p_users) then raise exception 'Choose distinct players'; end if;
  insert into public.rock_connect_rooms(title,kind,created_by)
    values(trim(p_title),'group',me) returning id into room;
  insert into public.rock_connect_members(room_id,user_id)
    select room, member from unnest(array_append(p_users,me)) as members(member);
  return room;
end $$;
revoke all on function public.rock_connect_create_group(text,uuid[]) from public,anon;
grant execute on function public.rock_connect_create_group(text,uuid[]) to authenticated;

alter table public.rock_connect_calls add column if not exists outcome text
  check(outcome in ('completed','declined','cancelled','missed'));

create or replace function public.rock_connect_validate_call()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or new.initiated_by<>auth.uid() or not public.rock_connect_is_member(new.room_id,auth.uid()) then
    raise exception 'Room membership required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.room_id::text,938));
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,937));
  if exists(select 1 from public.rock_connect_calls where initiated_by=auth.uid() and created_at>now()-interval '20 seconds') then
    raise exception 'Please wait before calling again';
  end if;
  if exists(select 1 from public.rock_connect_calls where room_id=new.room_id and expires_at>now()
    and (status='accepted' or (status='ringing' and created_at>now()-interval '60 seconds'))) then
    raise exception 'A call is already in progress in this chat';
  end if;
  new.created_at:=now();
  new.expires_at:=now()+interval '60 seconds';
  new.status:='ringing';
  new.outcome:=null;
  return new;
end $$;

create or replace function public.rock_connect_call_transition()
returns trigger language plpgsql security definer set search_path=public as $$
declare room_kind text;
begin
  if old.status='ended' then raise exception 'This call has ended'; end if;
  if new.status='accepted' then
    if old.expires_at<=now() or (old.status='ringing' and (old.created_at<=now()-interval '60 seconds' or auth.uid()=old.initiated_by)) then
      raise exception 'This invitation is no longer available';
    end if;
    if old.status='ringing' then new.expires_at:=now()+interval '2 hours'; end if;
  elsif new.status='ended' then
    select kind into room_kind from public.rock_connect_rooms where id=old.room_id;
    if auth.uid()<>old.initiated_by and room_kind<>'dm' then raise exception 'Only the caller can end a group call'; end if;
    new.outcome:=case when old.status='accepted' then 'completed'
      when old.created_at<=now()-interval '60 seconds' or old.expires_at<=now() then 'missed'
      when auth.uid()=old.initiated_by then 'cancelled' else 'declined' end;
  else
    raise exception 'Invalid call transition';
  end if;
  return new;
end $$;
drop trigger if exists rock_connect_call_transition on public.rock_connect_calls;
create trigger rock_connect_call_transition before update of status on public.rock_connect_calls
  for each row execute function public.rock_connect_call_transition();

create or replace function public.rock_connect_queue_push()
returns trigger language plpgsql security definer set search_path='' as $$
declare hook_key text; hook_url text; event_kind text;
begin
  if exists(select 1 from public.rock_connect_rooms where id=new.room_id and kind='lobby') then return new; end if;
  select decrypted_secret into hook_key from vault.decrypted_secrets where name='rock_connect_push_secret';
  select decrypted_secret into hook_url from vault.decrypted_secrets where name='rock_connect_push_url';
  if hook_key is null or hook_url is null then return new; end if;
  event_kind:=case when tg_table_name='rock_connect_calls' then 'call' else 'message' end;
  perform net.http_post(url:=hook_url, headers:=jsonb_build_object('Content-Type','application/json','x-rock-connect-secret',hook_key),
    body:=jsonb_build_object('action','connect_dispatch','kind',event_kind,'id',new.id), timeout_milliseconds:=60000);
  return new;
exception when others then
  raise warning 'Could not queue CONNECT notification for %',new.id;
  return new;
end $$;
revoke all on function public.rock_connect_queue_push() from public,anon,authenticated;
drop trigger if exists rock_connect_message_push on public.rock_connect_messages;
create trigger rock_connect_message_push after insert on public.rock_connect_messages
  for each row execute function public.rock_connect_queue_push();
drop trigger if exists rock_connect_call_push on public.rock_connect_calls;
create trigger rock_connect_call_push after insert on public.rock_connect_calls
  for each row execute function public.rock_connect_queue_push();

create or replace function public.rock_connect_push_targets(p_room uuid,p_sender uuid,p_after uuid)
returns table(id uuid,endpoint text,p256dh text,auth text,connect_user_id uuid)
language sql stable set search_path='' as $$
  select d.id,d.endpoint,d.p256dh,d.auth,d.connect_user_id from public.rock_app_devices d
    join public.rock_connect_members m on m.user_id=d.connect_user_id and m.room_id=p_room
    where d.connect_user_id<>p_sender and (p_after is null or d.id>p_after)
    order by d.id limit 100
$$;
revoke all on function public.rock_connect_push_targets(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.rock_connect_push_targets(uuid,uuid,uuid) to service_role;
commit;
