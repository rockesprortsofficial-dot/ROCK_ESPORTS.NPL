begin;
alter table public.rock_broadcast_studios add column custom_cohost_password boolean not null default false;
create table public.rock_tournament_cohost_attempts (
 studio_id uuid primary key references public.rock_broadcast_studios(id) on delete cascade,
 window_start timestamptz not null,
 attempts integer not null
);
alter table public.rock_tournament_cohost_attempts enable row level security;
revoke all on public.rock_tournament_cohost_attempts from public,anon,authenticated;
grant select,insert,update on public.rock_tournament_cohost_attempts to service_role;
create function public.rock_tournament_cohost_attempt(p_studio uuid)
returns boolean language sql security invoker set search_path='' as $$
 with accepted as (
  insert into public.rock_tournament_cohost_attempts as a(studio_id,window_start,attempts)
  select id,clock_timestamp(),1 from public.rock_broadcast_studios where id=p_studio and not ended and cohost_enabled and expires_at>now()
  on conflict(studio_id) do update set
    attempts=case when a.window_start<=clock_timestamp()-interval '1 minute' then 1 else a.attempts+1 end,
    window_start=case when a.window_start<=clock_timestamp()-interval '1 minute' then clock_timestamp() else a.window_start end
  where a.attempts<12 or a.window_start<=clock_timestamp()-interval '1 minute' returning 1
 ) select exists(select 1 from accepted);
$$;
revoke execute on function public.rock_tournament_cohost_attempt(uuid) from public,anon,authenticated;
grant execute on function public.rock_tournament_cohost_attempt(uuid) to service_role;


create table public.rock_tournament_feed (
  session_id uuid primary key references public.rock_broadcast_studios(id) on delete cascade,
  revision bigint not null default 0
);
alter table public.rock_tournament_feed enable row level security;
revoke all on public.rock_tournament_feed from public, anon, authenticated;
grant select on public.rock_tournament_feed to anon, authenticated;
create policy rock_tournament_feed_read on public.rock_tournament_feed for select to anon, authenticated using (true);
grant select,insert,update on public.rock_tournament_feed to service_role;

create table public.rock_tournament_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.rock_broadcast_studios(id) on delete cascade,
  visitor uuid not null,
  kind text not null check (kind in ('like','comment','block')),
  name text,
  message text,
  state text not null default 'pending' check (state in ('pending','visible','hidden')),
  created_at timestamptz not null default now()
);
alter table public.rock_tournament_events enable row level security;
revoke all on public.rock_tournament_events from public, anon, authenticated;
grant select,insert,update on public.rock_tournament_events to service_role;
create index rock_tournament_events_recent on public.rock_tournament_events(session_id,kind,created_at desc);
create unique index rock_tournament_visitor_once on public.rock_tournament_events(session_id,kind,visitor)
  where kind in ('like','block');

create function public.rock_tournament_interact(
  p_session uuid, p_action text, p_visitor uuid, p_name text, p_message text, p_event bigint, p_owner uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  session_row public.rock_broadcast_studios;
  target public.rock_tournament_events;
  is_owner boolean;
begin
  if p_action<>'read' then
    perform 1 from public.rock_broadcast_studios where id=p_session for update;
  end if;
  select * into session_row from public.rock_broadcast_studios
   where id=p_session and not ended and expires_at>now();
  if not found then return jsonb_build_object('error','Tournament session has ended'); end if;
  is_owner := p_owner is not null and p_owner=session_row.owner_id;
  if p_action in ('like','comment') then
    if not session_row.live then return jsonb_build_object('error','Tournament is offline'); end if;
    if p_visitor is null then return jsonb_build_object('error','Visitor ID required'); end if;
    if exists(select 1 from public.rock_tournament_events where session_id=p_session and visitor=p_visitor and kind='block') then
      return jsonb_build_object('error','Visitor is blocked');
    end if;
    if p_action='like' and exists(select 1 from public.rock_tournament_events where session_id=p_session and visitor=p_visitor and kind='like') then
      return jsonb_build_object('ok',true);
    end if;
    if (select count(*) from public.rock_tournament_events where session_id=p_session and kind=p_action and created_at>now()-interval '1 minute') >=
       (case when p_action='comment' then 30 else 180 end) then
      return jsonb_build_object('error','Too many requests. Try again shortly.');
    end if;
    if p_action='comment' then
      if coalesce(char_length(p_message),0) not between 1 and 240
         or coalesce(char_length(p_name),0) not between 1 and 32
         or p_message ~ '[[:cntrl:]]' or p_name ~ '[[:cntrl:]]' then
        return jsonb_build_object('error','Use a short name and a comment of up to 240 characters.');
      end if;
      if (select count(*) from public.rock_tournament_events where session_id=p_session and kind='comment' and state='pending') >= 100
         or exists(select 1 from public.rock_tournament_events where session_id=p_session and kind='comment' and visitor=p_visitor and created_at>now()-interval '20 seconds') then
        return jsonb_build_object('error','Come back in a moment before commenting again.');
      end if;
    end if;
    insert into public.rock_tournament_events(session_id,visitor,kind,name,message)
      values(p_session,p_visitor,p_action,p_name,p_message);
  elsif p_action in ('approve','hide','block') and is_owner then
    select * into target from public.rock_tournament_events where session_id=p_session and kind='comment' and id=p_event;
    if not found then return jsonb_build_object('error','Comment unavailable'); end if;
    if p_action='block' then
      insert into public.rock_tournament_events(session_id,visitor,kind) values(p_session,target.visitor,'block') on conflict do nothing;
      update public.rock_tournament_events set state='hidden' where session_id=p_session and kind='comment' and visitor=target.visitor;
    elsif p_action='hide' then
      update public.rock_tournament_events set state='hidden' where id=target.id;
    elsif not exists(select 1 from public.rock_tournament_events where session_id=p_session and kind='block' and visitor=target.visitor) then
      update public.rock_tournament_events set state='visible' where id=target.id;
    end if;
  elsif p_action<>'read' then
    return jsonb_build_object('error','Action unavailable');
  end if;

  if p_action<>'read' then
    insert into public.rock_tournament_feed(session_id,revision) values(p_session,1)
    on conflict(session_id) do update set revision=rock_tournament_feed.revision+1;
    return jsonb_build_object('ok',true);
  end if;
  return jsonb_build_object(
    'likes',(select count(*) from public.rock_tournament_events where session_id=p_session and kind='like'),
    'comment_count',(select count(*) from public.rock_tournament_events where session_id=p_session and kind='comment' and state='visible'),
    'liked',exists(select 1 from public.rock_tournament_events where session_id=p_session and kind='like' and visitor=p_visitor),
    'comments',coalesce((select jsonb_agg(to_jsonb(c) order by c.id desc) from
      (select id,name,message,state from public.rock_tournament_events
       where session_id=p_session and kind='comment' and (state='visible' or (is_owner and state='pending'))
       order by id desc limit 100) c),'[]'::jsonb)
  );
end;
$$;
revoke execute on function public.rock_tournament_interact(uuid,text,uuid,text,text,bigint,uuid) from public, anon, authenticated;
grant execute on function public.rock_tournament_interact(uuid,text,uuid,text,text,bigint,uuid) to service_role;
commit;
