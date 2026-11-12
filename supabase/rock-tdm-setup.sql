-- TDM-only additive storage. Do not replace the legacy live draw table or its policies.
begin;
create table if not exists public.rock_tdm_tournaments(
 id uuid primary key default gen_random_uuid(), revision bigint not null default 0,
 state jsonb not null, updated_at timestamptz not null default now()
);
create table if not exists public.rock_tdm_legacy_snapshots(
 id text primary key, state jsonb not null, captured_at timestamptz not null default now()
);
alter table public.rock_tdm_tournaments enable row level security;
alter table public.rock_tdm_legacy_snapshots enable row level security;
revoke all on public.rock_tdm_tournaments,public.rock_tdm_legacy_snapshots from anon,authenticated;
-- Preserve the original database object byte-for-byte as JSON, including all player media.
-- This is a copy only: the shared legacy row and all unrelated features remain untouched.
do $$ begin
 if to_regclass('public.rock_esports_live_draw') is not null then
  execute $q$insert into public.rock_tdm_legacy_snapshots(id,state)
   select id::text||':'||md5(state::text),state from public.rock_esports_live_draw
   where state->>'stage'='tdmGroups' on conflict do nothing$q$;
 end if;
end $$;

create or replace function public.rock_tdm_graph(n integer, draw_order jsonb)
returns jsonb language plpgsql immutable set search_path=public,pg_temp as $$
declare g jsonb:='[]'; pool jsonb; next_pool jsonb; pass jsonb; initial jsonb:='[]';
 lane text; i integer; r integer; k integer; total integer; power integer; pairs integer; mid text; item jsonb; w_semis jsonb; l_champion jsonb;
begin
 if n not in (8,16,24,32) then raise exception 'Invalid player count'; end if;
 for i in 0..n/2-1 loop
  initial:=initial||jsonb_build_array(jsonb_build_object('match','M'||(i+1),'out','win'));
  g:=g||jsonb_build_array(jsonb_build_object('id','M'||(i+1),'a',jsonb_build_object('slot',i*2),'b',jsonb_build_object('slot',i*2+1),'lane','group','round',0));
 end loop;
 foreach lane in array array['W','L'] loop
  pool:='[]';r:=1;k:=1;
  for item in select value from jsonb_array_elements(draw_order) loop
   pool:=pool||jsonb_build_array(jsonb_build_object('match','M'||((item#>>'{}')::integer+1),'out',case when lane='W' then 'win' else 'lose' end));
  end loop;
  while jsonb_array_length(pool)>case when lane='W' then 2 else 1 end loop
   total:=jsonb_array_length(pool);power:=1;while power*2<=total loop power:=power*2;end loop;
   pairs:=case when power=total then total/2 else total-power end;next_pool:='[]';pass:='[]';
   for i in 0..pairs-1 loop
    mid:=lane||k;k:=k+1;
    g:=g||jsonb_build_array(jsonb_build_object('id',mid,'a',pool->(i*2),'b',pool->(i*2+1),'lane',lane,'round',r));
    next_pool:=next_pool||jsonb_build_array(jsonb_build_object('match',mid,'out','win'));
   end loop;
   if pairs*2<total then for i in pairs*2..total-1 loop pass:=pass||jsonb_build_array(pool->i);end loop;end if;
   pool:=next_pool||pass;r:=r+1;
  end loop;
  if lane='W' then
   w_semis:=pool;g:=g||jsonb_build_array(jsonb_build_object('id','GF','a',pool->0,'b',pool->1,'lane',lane,'round',r));
  else l_champion:=pool->0;end if;
 end loop;
 g:=g||jsonb_build_array(jsonb_build_object('id','TP','a',jsonb_set(w_semis->0,'{out}','"lose"'),'b',jsonb_set(w_semis->1,'{out}','"lose"'),'lane','P','round',0));
 g:=g||jsonb_build_array(jsonb_build_object('id','FP','a',jsonb_build_object('match','TP','out','lose'),'b',l_champion,'lane','P','round',1));
 return g;
end $$;
create or replace function public.rock_tdm_resolve(s jsonb,g jsonb,ref jsonb)
returns integer language plpgsql immutable set search_path=public,pg_temp as $$
declare m jsonb; a integer; b integer; w integer; slot integer;
begin
 if ref ? 'slot' then slot:=(ref->>'slot')::integer;return case when (s->>'revealed')::integer>slot then slot else null end;end if;
 select value into m from jsonb_array_elements(g) where value->>'id'=ref->>'match';
 if m is null or not (s->'results' ? (ref->>'match')) then return null;end if;
 a:=public.rock_tdm_resolve(s,g,m->'a');b:=public.rock_tdm_resolve(s,g,m->'b');w:=(s->'results'->(ref->>'match')->>'winner')::integer;
 if a is null or b is null or w not in (a,b) then return null;end if;
 return case when ref->>'out'='lose' then case when w=a then b else a end else w end;
end $$;
create or replace function public.rock_tdm_draw(s jsonb)
returns jsonb language plpgsql volatile set search_path=public,pg_temp as $$
declare g jsonb; ids jsonb; m jsonb; already boolean;
begin
 g:=coalesce(s->'bracket',public.rock_tdm_graph(jsonb_array_length(s->'participants'),s->'order'));ids:='[]';
 for m in select value from jsonb_array_elements(g) loop
  select exists(select 1 from jsonb_array_elements(s->'draws') d where d->'matches' ? (m->>'id')) into already;
  if not already and public.rock_tdm_resolve(s,g,m->'a') is not null and public.rock_tdm_resolve(s,g,m->'b') is not null then ids:=ids||jsonb_build_array(m->>'id');end if;
 end loop;
 if jsonb_array_length(ids)=0 then raise exception 'No new round is ready. Finish the current matches first.';end if;
 s:=jsonb_set(s,'{draws}',s->'draws'||jsonb_build_array(jsonb_build_object('at',clock_timestamp(),'matches',ids)));
 return jsonb_set(s,'{events}',s->'events'||jsonb_build_array(jsonb_build_object('at',clock_timestamp(),'type','ROUND DRAW','matches',ids)));
end $$;
create or replace function public.rock_tdm_list()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare output jsonb;
begin
 -- Scheduled reveals are materialized by the server, independent of any owner browser.
 update public.rock_tdm_tournaments set state=jsonb_set(jsonb_set(state,'{revealed}',to_jsonb(jsonb_array_length(state->'participants'))),'{events}',state->'events'||jsonb_build_array(jsonb_build_object('at',clock_timestamp(),'type','SCHEDULED REVEAL'))),revision=revision+1,updated_at=now()
 where state->>'scheduledAt' is not null and (state->>'scheduledAt')::timestamptz<=clock_timestamp() and (state->>'revealed')::integer<jsonb_array_length(state->'participants');
 -- Initial match identities are fixed by the first draw, even before chit reveal.
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'revision',revision,'state',state) order by state->>'createdAt' desc),'[]') into output from public.rock_tdm_tournaments;
 return output;
end $$;
create or replace function public.rock_tdm_legacy_list()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'state',state,'capturedAt',captured_at)),'[]') from public.rock_tdm_legacy_snapshots;
$$;
create or replace function public.rock_tdm_owner(p_id uuid,p_revision bigint,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t public.rock_tdm_tournaments; s jsonb; n integer; ps jsonb; ord jsonb; at_time timestamptz:=clock_timestamp();
 g jsonb; m jsonb; a integer; b integer; w integer; scores jsonb; drawn boolean; ids jsonb; starts timestamptz;
begin
 if auth.uid() is null or lower(coalesce(auth.jwt()->>'email',''))<>'rockesprorts.official@gmail.com' then raise exception 'Owner login required' using errcode='42501';end if;
 if p_action='create' then
  ps:=p_payload->'participants';if jsonb_typeof(ps) is distinct from 'array' then raise exception 'Player list required';end if;n:=jsonb_array_length(ps);
  if n not in (8,16,24,32) then raise exception 'Exactly 8,16,24 or 32 players required';end if;
  if exists(select 1 from jsonb_array_elements(ps) p where length(trim(p->>'name')) not between 1 and 100 or p->>'name' is null) then raise exception 'Invalid player name';end if;
  if (select count(distinct lower(trim(p->>'name'))) from jsonb_array_elements(ps) p)<>n then raise exception 'Unique player names required';end if;
  if exists(select 1 from jsonb_array_elements(ps) p cross join lateral (values(p->>'photo'),(p->>'logo')) u(url) where coalesce(url,'')<>'' and url!~* '^(https://|data:image/(png|jpeg|webp);base64,)') then raise exception 'Invalid image URL';end if;
  if octet_length(ps::text)>15000000 then raise exception 'Player media too large';end if;
  if length(coalesce(p_payload->>'title','')) not between 1 and 120 then raise exception 'Tournament title required';end if;
  if jsonb_typeof(p_payload->'prizes') is distinct from 'array' or jsonb_array_length(p_payload->'prizes')<>4 then raise exception 'Four prize labels required';end if;
  select jsonb_agg(value order by random()) into ps from jsonb_array_elements(ps);
  -- For 24 players, draw order fixes the four preliminary matches and four byes per lane.
  select jsonb_agg(i order by case when n=24 then random() else i::float end) into ord from generate_series(0,n/2-1) i;
  starts:=(p_payload->>'scheduledAt')::timestamptz;
  if starts is not null and starts<at_time then raise exception 'Schedule must be in the future';end if;
  s:=jsonb_build_object('version',3,'title',p_payload->>'title','createdAt',at_time,'scheduledAt',starts,'participants',ps,'order',ord,'prizes',p_payload->'prizes','revealed',0,'results','{}'::jsonb,'events',jsonb_build_array(jsonb_build_object('at',at_time,'type','INITIAL DRAW')),'draws','[]'::jsonb);
  g:=public.rock_tdm_graph(n,ord);s:=jsonb_set(s,'{bracket}',g);select jsonb_agg(value->>'id') into ids from jsonb_array_elements(g) where value->>'lane'='group';
  s:=jsonb_set(s,'{draws}',jsonb_build_array(jsonb_build_object('at',at_time,'matches',ids)));
  insert into public.rock_tdm_tournaments(state) values(s) returning * into t;
 else
  select * into t from public.rock_tdm_tournaments where id=p_id for update;
  if not found then raise exception 'Tournament not found';end if;
  if t.revision<>p_revision then raise exception 'Another session changed this tournament. Refresh and retry.' using errcode='40001';end if;
  s:=t.state;n:=jsonb_array_length(s->'participants');g:=coalesce(s->'bracket',public.rock_tdm_graph(n,s->'order'));
  if p_action='delete' then
   if p_payload->>'confirmation' is distinct from p_id::text then raise exception 'Deletion confirmation required';end if;
   delete from public.rock_tdm_tournaments where id=p_id;return jsonb_build_object('deleted',p_id);
  elsif p_action='reveal' then
   if (s->>'revealed')::integer>=n then raise exception 'All chits are open';end if;
   s:=jsonb_set(s,'{revealed}',to_jsonb((s->>'revealed')::integer+1));
   s:=jsonb_set(s,'{events}',s->'events'||jsonb_build_array(jsonb_build_object('at',at_time,'type','CHIT REVEAL','slot',(s->>'revealed')::integer-1)));
  elsif p_action='draw' then s:=public.rock_tdm_draw(s);
  elsif p_action='confirm' then
   select value into m from jsonb_array_elements(g) where value->>'id'=p_payload->>'match';
   if m is null then raise exception 'Unknown match';end if;
   if s->'results' ? (m->>'id') then raise exception 'Confirmed results are immutable';end if;
   select exists(select 1 from jsonb_array_elements(s->'draws') d where d->'matches' ? (m->>'id')) into drawn;
   if not drawn then raise exception 'Draw this round first';end if;
   a:=public.rock_tdm_resolve(s,g,m->'a');b:=public.rock_tdm_resolve(s,g,m->'b');w:=(p_payload->>'winner')::integer;scores:=p_payload->'scores';
   if a is null or b is null or w is null or w not in (a,b) then raise exception 'Match not ready or invalid winner';end if;
   if jsonb_typeof(scores) is distinct from 'array' or jsonb_array_length(scores)<>2 then raise exception 'Two scores required';end if;
   if exists(select 1 from jsonb_array_elements_text(scores) x where x!~ '^[0-9]{1,3}$') then raise exception 'Scores must be integers 0 to 999';end if;
   if (w=a and (scores->>0)::integer<=(scores->>1)::integer) or (w=b and (scores->>1)::integer<=(scores->>0)::integer) then raise exception 'Winner must have the higher score';end if;
   s:=jsonb_set(s,array['results',m->>'id'],jsonb_build_object('winner',w,'scores',scores,'at',at_time));
   s:=jsonb_set(s,'{events}',s->'events'||jsonb_build_array(jsonb_build_object('at',at_time,'type','MATCH CONFIRMED','match',m->>'id','winner',w,'loser',case when w=a then b else a end,'scores',scores)));
  else raise exception 'Unknown action';end if;
  update public.rock_tdm_tournaments set state=s,revision=revision+1,updated_at=at_time where id=p_id returning * into t;
 end if;
 return jsonb_build_object('id',t.id,'revision',t.revision,'state',t.state);
end $$;
revoke all on function public.rock_tdm_graph(integer,jsonb),public.rock_tdm_resolve(jsonb,jsonb,jsonb),public.rock_tdm_draw(jsonb),public.rock_tdm_list(),public.rock_tdm_legacy_list(),public.rock_tdm_owner(uuid,bigint,text,jsonb) from public;
grant execute on function public.rock_tdm_list(),public.rock_tdm_legacy_list() to anon,authenticated;
grant execute on function public.rock_tdm_owner(uuid,bigint,text,jsonb) to authenticated;
commit;
