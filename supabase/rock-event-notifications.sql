-- Automatic public announcements use the existing push service and owner authorization.
alter table public.rock_esports_tournament_settings add column if not exists notification_mode text not null default 'test' check(notification_mode in ('test','real'));
alter table public.rock_esports_tournament_settings add column if not exists notification_id uuid;

create or replace function public.rock_event_notice(p_kind text,p_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare t jsonb; r public.rock_esports_tournament_settings; n public.rock_app_notices; title text; message text; section text;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Server authorization required';end if;
 if p_kind='tournament' then
  select e into t from public.rock_esports_site s cross join lateral jsonb_array_elements(coalesce(s.content->'tournaments','[]'::jsonb)) e where e->>'notificationId'=p_id::text and e->>'notificationMode'='real' and e->>'status'='Published' limit 1;
  if t is null or nullif(trim(t->>'title'),'') is null then return null;end if;
  section:='tournament';title:='ROCK ESPORTS • नयाँ प्रतियोगिता / New Tournament';
  message:=left(trim(t->>'title'),120)||E'\nनयाँ प्रतियोगिता प्रकाशित भयो! विवरण हेर्नुहोस् र सहभागी हुनुहोस्।'||E'\nA new tournament is here! View the details and join the competition.';
  if coalesce(nullif(t->>'dateTime',''),nullif(t->>'date','')) is not null then message:=message||E'\nखेल मिति / Match: '||left(replace(coalesce(nullif(t->>'dateTime',''),t->>'date'),'T',' '),60);end if;
  if nullif(t->>'prize','') is not null then message:=message||E'\nपुरस्कार / Prize pool: '||left(t->>'prize',80);end if;
  message:=message||E'\nपूरा विवरण खोल्नुहोस् / Tap for full details.';
 elsif p_kind='registration' then
  select * into r from public.rock_esports_tournament_settings where notification_id=p_id and notification_mode='real' and is_open and cardinality(active_types)>0 and (registration_closes_at is null or registration_closes_at>now()) limit 1;
  if r.id is null or nullif(trim(r.event_title),'') is null then return null;end if;
  section:='registration';title:='ROCK ESPORTS • दर्ता सूचना / Registration';
  message:=left(trim(r.event_title),120)||E'\nदर्ता प्रकाशित भयो! समयभित्र आफ्नो स्थान सुरक्षित गर्नुहोस्।'||E'\nRegistration announced! Secure your place before the deadline.';
  message:=message||E'\nखेल / Format: '||array_to_string(r.active_types,' + ');
  if r.event_date is not null then message:=message||E'\nखेल मिति / Match date: '||r.event_date::text;end if;
  if r.registration_opens_at is not null then message:=message||E'\nदर्ता खुल्ने / Opens: '||to_char(r.registration_opens_at at time zone 'Asia/Kathmandu','DD Mon YYYY HH24:MI')||' NPT';end if;
  if r.registration_closes_at is not null then message:=message||E'\nअन्तिम मिति / Deadline: '||to_char(r.registration_closes_at at time zone 'Asia/Kathmandu','DD Mon YYYY HH24:MI')||' NPT';end if;
  message:=message||E'\nदर्ता विवरण खोल्नुहोस् / Tap for registration details.';
 else raise exception 'Invalid publication kind';end if;
 -- Freeze a publication's message so retries and ordinary edits cannot duplicate it.
 select * into n from public.rock_app_notices where id=p_id;
 if n.id is not null then
  if n.audience<>'public' or n.section<>section then raise exception 'Publication ID already used';end if;
  title:=n.title;message:=n.message;
 end if;
 return jsonb_build_object('notification_id',p_id,'audience','public','title',title,'message',message,'section',section);
end $$;
revoke all on function public.rock_event_notice(text,uuid) from public,anon,authenticated;
grant execute on function public.rock_event_notice(text,uuid) to service_role;

create table if not exists public.rock_event_announcements(
 id uuid primary key references public.rock_app_notices(id) on delete cascade,
 completed boolean not null default false
);
alter table public.rock_event_announcements enable row level security;
revoke all on public.rock_event_announcements from public,anon,authenticated;
grant all on public.rock_event_announcements to service_role;
