create table if not exists public.rock_app_devices(
 id uuid primary key default gen_random_uuid(),endpoint text not null unique,endpoint_hash text generated always as (encode(extensions.digest(endpoint,'sha256'),'hex')) stored unique,p256dh text not null,auth text not null,manage_hash text not null,
 public_opt_in boolean not null default true,member_id uuid references public.rock_meeting_members(id) on delete set null,member_opt_in boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.rock_app_notices(
 id uuid primary key,audience text not null check(audience in ('public','members')),title text not null check(char_length(title) between 1 and 120),message text not null check(char_length(message) between 1 and 1200),section text not null default 'notifications',
 created_by text not null,created_at timestamptz not null default now(),public_notice_id text);
create table if not exists public.rock_app_push_deliveries(
 notice_id uuid not null references public.rock_app_notices(id) on delete cascade,endpoint_hash text not null,state text not null default 'pending' check(state in ('pending','sent','failed')),created_at timestamptz not null default now(),primary key(notice_id,endpoint_hash));
alter table public.rock_app_devices enable row level security;
alter table public.rock_app_notices enable row level security;
alter table public.rock_app_push_deliveries enable row level security;
revoke all on public.rock_app_devices,public.rock_app_notices,public.rock_app_push_deliveries from anon,authenticated;
grant all on public.rock_app_devices,public.rock_app_notices,public.rock_app_push_deliveries to service_role;
-- Legacy push keys also remain server-only. Existing Edge Function access is preserved.
alter table public.rock_push_subscriptions enable row level security;
revoke all on public.rock_push_subscriptions from anon,authenticated;

create or replace function public.rock_app_publish(p_id uuid,p_audience text,p_title text,p_message text,p_section text,p_owner text)
returns public.rock_app_notices language plpgsql security definer set search_path=public as $$
declare result public.rock_app_notices; public_id text;
begin
 if p_owner<>'rockesprorts.official@gmail.com' or p_audience not in ('public','members') then raise exception 'Owner publication required';end if;
 insert into rock_app_notices(id,audience,title,message,section,created_by) values(p_id,p_audience,p_title,p_message,p_section,p_owner) on conflict(id) do nothing;
 select * into result from rock_app_notices where id=p_id for update;
 if result.audience<>p_audience or result.title<>p_title or result.message<>p_message or result.section<>p_section then raise exception 'Publication id already used';end if;
 if result.audience='public' and result.public_notice_id is null then
  insert into rock_notifications(title,message,section,created_by) values(p_title,p_message,p_section,p_owner) returning id::text into public_id;
  update rock_app_notices set public_notice_id=public_id where id=p_id returning * into result;
 end if;
 return result;
end $$;
revoke all on function public.rock_app_publish(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.rock_app_publish(uuid,text,text,text,text,text) to service_role;

create or replace function public.rock_app_push_targets(p_notice uuid,p_limit integer default 100)
returns table(endpoint_hash text,endpoint text,p256dh text,auth text) language sql stable security definer set search_path=public,extensions as $$
 with notice as(select audience from rock_app_notices where id=p_notice), candidates as(
  select d.endpoint,d.p256dh,d.auth from rock_app_devices d cross join notice n
   where (n.audience='public' and d.public_opt_in) or (n.audience='members' and d.member_opt_in and exists(select 1 from rock_meeting_members m where m.id=d.member_id and m.team_slug='rock-esports' and m.is_active))
  union all
  select distinct on(l.endpoint) l.endpoint,l.p256dh,l.auth from rock_push_subscriptions l cross join notice n
   where n.audience='public' and not exists(select 1 from rock_app_devices d where d.endpoint=l.endpoint)
 )
 select encode(digest(c.endpoint,'sha256'),'hex'),c.endpoint,c.p256dh,c.auth from candidates c
 where not exists(select 1 from rock_app_push_deliveries x where x.notice_id=p_notice and x.endpoint_hash=encode(digest(c.endpoint,'sha256'),'hex'))
 order by c.endpoint limit greatest(1,least(p_limit,100));
$$;
revoke all on function public.rock_app_push_targets(uuid,integer) from public,anon,authenticated;
grant execute on function public.rock_app_push_targets(uuid,integer) to service_role;

create or replace function public.rock_app_claim_push(p_notice uuid,p_endpoint_hash text) returns boolean language plpgsql security definer set search_path=public as $$
declare audience text;
begin
 select n.audience into audience from rock_app_notices n where n.id=p_notice;
 if audience='members' then
  if not exists(select 1 from rock_app_devices d join rock_meeting_members m on m.id=d.member_id where d.endpoint_hash=p_endpoint_hash and d.member_opt_in and m.is_active and m.team_slug='rock-esports') then return false;end if;
 elsif audience='public' then
  if not exists(select 1 from rock_app_devices d where d.endpoint_hash=p_endpoint_hash and d.public_opt_in) and not exists(select 1 from rock_push_subscriptions l where encode(extensions.digest(l.endpoint,'sha256'),'hex')=p_endpoint_hash and not exists(select 1 from rock_app_devices d where d.endpoint=l.endpoint)) then return false;end if;
 else return false;end if;
 insert into rock_app_push_deliveries(notice_id,endpoint_hash) values(p_notice,p_endpoint_hash) on conflict do nothing;return found;
end $$;
revoke all on function public.rock_app_claim_push(uuid,text) from public,anon,authenticated;
grant execute on function public.rock_app_claim_push(uuid,text) to service_role;

create or replace function public.rock_app_push_counts() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('public',(select count(*) from rock_app_devices where public_opt_in)+(select count(distinct l.endpoint) from rock_push_subscriptions l where not exists(select 1 from rock_app_devices d where d.endpoint=l.endpoint)),
 'members',(select count(*) from rock_app_devices d where d.member_opt_in and exists(select 1 from rock_meeting_members m where m.id=d.member_id and m.team_slug='rock-esports' and m.is_active)));
$$;
revoke all on function public.rock_app_push_counts() from public,anon,authenticated;
grant execute on function public.rock_app_push_counts() to service_role;
