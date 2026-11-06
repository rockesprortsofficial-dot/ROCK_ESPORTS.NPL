-- Additive WOW setup: does not change existing site, tournament or TDM tables.
-- Run once in the existing project's Supabase SQL Editor, as the project owner.
begin;
create table if not exists public.rock_wow_tournaments (
 mode integer primary key check(mode in (2,3,4)),
 revision bigint not null default 0,
 state jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.rock_wow_tournaments enable row level security;
revoke all on public.rock_wow_tournaments from anon,authenticated;
insert into public.rock_wow_tournaments(mode,state)
select n,jsonb_build_object('mode',n,'teams','[]'::jsonb,'groups','[{"id":"group-a","name":"GROUP A"},{"id":"group-b","name":"GROUP B"}]'::jsonb,'draw',null,'seeds','[]'::jsonb,'results','{}'::jsonb)
from unnest(array[2,3,4]) n on conflict(mode) do nothing;

drop function if exists public.rock_wow_public(integer);
create or replace function public.rock_wow_public(p_mode integer,p_known_revision bigint default null,p_known_revealed integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.rock_wow_tournaments; s jsonb; d jsonb; n integer; visible_order jsonb; clock_time timestamptz:=clock_timestamp();
begin
 select * into r from public.rock_wow_tournaments where mode=p_mode;
 if not found then raise exception 'Unknown WOW mode'; end if;
 s:=r.state;d:=s->'draw';n:=0;
 if d is not null and d<>'null'::jsonb then
  n:=case when d->>'manual'='true' then (d->>'revealed')::integer
    else least(jsonb_array_length(d->'order'),greatest(0,floor(extract(epoch from (clock_time-(d->>'startsAt')::timestamptz))/3)::integer+1)) end;
  select coalesce(jsonb_agg(value order by ord),'[]'::jsonb) into visible_order from jsonb_array_elements(d->'order') with ordinality a(value,ord) where ord<=n;
  s:=jsonb_set(s,'{draw}',jsonb_build_object('startsAt',d->>'startsAt','order',visible_order,'revealed',n,
    'manual',coalesce((d->>'manual')::boolean,false),'finished',coalesce((d->>'finished')::boolean,false)));
 end if;
 if p_known_revision=r.revision and p_known_revealed=n then
  return jsonb_build_object('unchanged',true,'revision',r.revision,'server_now',clock_time);
 end if;
 return jsonb_build_object('state',s,'revision',r.revision,'server_now',clock_time);
end; $$;
revoke all on function public.rock_wow_public(integer,bigint,integer) from public;
grant execute on function public.rock_wow_public(integer,bigint,integer) to anon,authenticated;

create or replace function public.rock_wow_owner(p_mode integer,p_revision bigint,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.rock_wow_tournaments; s jsonb; d jsonb; draw_order jsonb; starts timestamptz; item jsonb; player jsonb; total integer; previous_ids jsonb; next_ids jsonb;
begin
 if auth.uid() is null or lower(coalesce(auth.jwt()->>'email',''))<>'rockesprorts.official@gmail.com' then raise exception 'Owner login required' using errcode='42501'; end if;
 select * into r from public.rock_wow_tournaments where mode=p_mode for update;
 if not found then raise exception 'Unknown WOW mode'; end if;
 if r.revision<>p_revision then raise exception 'Another session changed this tournament. Cancel, refresh and retry.' using errcode='40001'; end if;
 s:=r.state;d:=s->'draw';
 if p_action='reset' then
  s:=s||jsonb_build_object('draw',null,'seeds','[]'::jsonb,'results','{}'::jsonb);
 elsif p_action='draw' then
  if s->'draw'<>'null'::jsonb then raise exception 'Reset the previous draw first'; end if;
  total:=jsonb_array_length(s->'teams');
  if total<2 then raise exception 'Add at least two teams'; end if;
  if jsonb_array_length(s->'groups')>total then raise exception 'Groups cannot exceed team count'; end if;
  starts:=(p_payload->>'startsAt')::timestamptz;
  if starts is null then raise exception 'Draw time required'; end if;
  -- Manual starts may arrive a few seconds after the owner clicks.
  if starts<clock_timestamp()-interval '1 minute' then raise exception 'Draw time is in the past'; end if;
  starts:=greatest(starts,clock_timestamp());
  select jsonb_agg(value->'id' order by random()) into draw_order from jsonb_array_elements(s->'teams');
  s:=s||jsonb_build_object('draw',jsonb_build_object('startsAt',starts,'order',draw_order,
    'manual',coalesce((p_payload->>'manual')::boolean,false),'revealed',0,'finished',false),'seeds','[]'::jsonb,'results','{}'::jsonb);
 elsif p_action='reveal' then
  if d->>'manual' is distinct from 'true' or d->>'finished'='true' then raise exception 'Prepare a manual WOW draw first'; end if;
  if (d->>'revealed')::integer>=jsonb_array_length(d->'order') then raise exception 'All chits are open. Finish the round.'; end if;
  s:=jsonb_set(s,'{draw,revealed}',to_jsonb((d->>'revealed')::integer+1));
 elsif p_action='finish' then
  if d is null or d='null'::jsonb then raise exception 'Prepare the WOW draw first'; end if;
  if (case when d->>'manual'='true' then (d->>'revealed')::integer<jsonb_array_length(d->'order')
    else clock_timestamp()<(d->>'startsAt')::timestamptz+make_interval(secs=>greatest(0,jsonb_array_length(d->'order')-1)*3) end)
    then raise exception 'Open all chits before finishing the round'; end if;
  s:=jsonb_set(s,'{draw,finished}','true'::jsonb);
 elsif p_action='save' then
  if p_payload is null or octet_length(p_payload::text)>16000000 then raise exception 'Tournament is too large. Use smaller images.'; end if;
  if jsonb_typeof(p_payload->'teams') is distinct from 'array' or jsonb_typeof(p_payload->'groups') is distinct from 'array' or jsonb_typeof(p_payload->'seeds') is distinct from 'array' or jsonb_typeof(p_payload->'results') is distinct from 'object' then raise exception 'Invalid tournament data'; end if;
  if jsonb_array_length(p_payload->'groups')<1 then raise exception 'At least one group required'; end if;
  for item in select value from jsonb_array_elements(p_payload->'groups') loop
   if coalesce(length(item->>'id'),0)=0 or coalesce(length(trim(item->>'name')),0) not between 1 and 60 then raise exception 'Group ID and name required'; end if;
  end loop;
  if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(p_payload->'groups')) then raise exception 'Duplicate group ID'; end if;
  for item in select value from jsonb_array_elements(p_payload->'teams') loop
   if coalesce(length(item->>'id'),0)=0 or coalesce(length(trim(item->>'name')),0) not between 1 and 80 then raise exception 'Team ID and name required'; end if;
   if jsonb_typeof(item->'players') is distinct from 'array' then raise exception 'Player roster required'; end if;
   if jsonb_array_length(item->'players')<>p_mode then raise exception 'Player count must match mode'; end if;
   for player in select value from jsonb_array_elements(item->'players') loop
    if coalesce(length(trim(player->>'name')),0) not between 1 and 80 then raise exception 'Each player needs a name'; end if;
   end loop;
  end loop;
  if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(p_payload->'teams')) then raise exception 'Duplicate team ID'; end if;
  if s->'draw'<>'null'::jsonb then
   select coalesce(jsonb_agg(value->'id' order by ord),'[]'::jsonb) into previous_ids from jsonb_array_elements(s->'teams') with ordinality a(value,ord);
   select coalesce(jsonb_agg(value->'id' order by ord),'[]'::jsonb) into next_ids from jsonb_array_elements(p_payload->'teams') with ordinality a(value,ord);
   if previous_ids<>next_ids or s->'groups'<>p_payload->'groups' then raise exception 'Reset draw before adding/removing teams or changing groups'; end if;
  end if;
  if jsonb_array_length(p_payload->'seeds')>0 then
   if d='null'::jsonb or (case when d->>'manual'='true' then d->>'finished'<>'true'
    else clock_timestamp()<(d->>'startsAt')::timestamptz+make_interval(secs=>greatest(0,jsonb_array_length(s->'teams')-1)*3) end)
    then raise exception 'Wait for the draw to finish'; end if;
   if jsonb_array_length(p_payload->'seeds')<2 then raise exception 'At least two qualifiers required'; end if;
   if exists(select 1 from jsonb_array_elements(p_payload->'seeds') seed where not exists(select 1 from jsonb_array_elements(p_payload->'teams') t where t->'id'=seed)) then raise exception 'Unknown qualifier'; end if;
   if (select count(*)<>count(distinct value) from jsonb_array_elements(p_payload->'seeds')) then raise exception 'Duplicate qualifier'; end if;
  end if;
  s:=s||jsonb_build_object('mode',p_mode,'teams',p_payload->'teams','groups',p_payload->'groups','seeds',p_payload->'seeds','results',p_payload->'results');
 else raise exception 'Unknown action'; end if;
 update public.rock_wow_tournaments set state=s,revision=revision+1,updated_at=clock_timestamp() where mode=p_mode;
 return public.rock_wow_public(p_mode);
end; $$;
revoke all on function public.rock_wow_owner(integer,bigint,text,jsonb) from public,anon;
grant execute on function public.rock_wow_owner(integer,bigint,text,jsonb) to authenticated;
commit;
