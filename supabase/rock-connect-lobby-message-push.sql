begin;

create or replace function public.rock_connect_queue_push()
returns trigger language plpgsql security definer set search_path='' as $$
declare hook_key text; hook_url text; event_kind text;
begin
  if tg_table_name='rock_connect_calls' and exists(
    select 1 from public.rock_connect_rooms where id=new.room_id and kind='lobby'
  ) then return new; end if;
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

commit;
