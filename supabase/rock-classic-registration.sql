-- Additive roster storage: existing TDM and historical registration rows are preserved.
alter table public.rock_esports_registrations add column if not exists classic_players jsonb not null default '[]'::jsonb;
create or replace function public.rock_classic_registration_validate()
returns trigger language plpgsql set search_path=public as $$
declare p jsonb; n integer:=0; uids text[]:='{}'; photos text[]:='{}'; prefix text:='registrations/'||new.id::text||'/'; title text;
begin
 if new.tournament_type<>'CLASSIC' then
  if new.classic_players<>'[]'::jsonb then raise exception 'TDM registration cannot contain a Classic roster' using errcode='23514';end if;return new;
 end if;
 if jsonb_typeof(new.classic_players) is distinct from 'array' then raise exception 'Four Classic players required' using errcode='23514';end if;
 if jsonb_array_length(new.classic_players)<>4 or octet_length(new.classic_players::text)>16000 then raise exception 'Exactly four Classic players required' using errcode='23514';end if;
 if nullif(trim(new.team_name),'') is null or length(new.team_name)>100 or new.email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(new.email)>180 or nullif(trim(new.phone_number),'') is null or length(new.phone_number)>30 then raise exception 'Team name, email and phone required' using errcode='23514';end if;
 for p in select value from jsonb_array_elements(new.classic_players) loop
  n:=n+1;
  if p->>'slot' is distinct from n::text or nullif(trim(p->>'real_full_name'),'') is null or length(p->>'real_full_name')>120 or nullif(trim(p->>'pubg_player_name'),'') is null or length(p->>'pubg_player_name')>100 or coalesce(p->>'pubg_uid','')!~'^[0-9]{1,30}$' or p->>'pubg_uid'=any(uids) then raise exception 'Each player needs a photo, real name, PUBG name and distinct numeric UID' using errcode='23514';end if;
  if coalesce(p->>'player_photo_path','') not like prefix||'player-'||n::text||'-photo.%' or coalesce(p->>'player_photo_path','')~'\.\.' or p->>'player_photo_path'=any(photos) then raise exception 'Invalid player photo mapping' using errcode='23514';end if;
  uids:=array_append(uids,p->>'pubg_uid');photos:=array_append(photos,p->>'player_photo_path');
 end loop;
 if new.team_logo_path not like prefix||'team-logo.%' or new.team_logo_path~'\.\.' or new.team_logo_path=any(photos) then raise exception 'Team logo must be separate from player photos' using errcode='23514';end if;
 p:=new.classic_players->0;
 if new.real_full_name is distinct from p->>'real_full_name' or new.pubg_player_name is distinct from p->>'pubg_player_name' or new.pubg_uid is distinct from p->>'pubg_uid' or new.player_photo_path is distinct from p->>'player_photo_path' then raise exception 'Player 1 compatibility fields do not match' using errcode='23514';end if;
 if tg_op='INSERT' then
  select coalesce(nullif(s.event_title,''),'ROCK ESPORTS TOURNAMENT') into title from public.rock_esports_tournament_settings s where s.id=1;
  if new.event_title is distinct from title then raise exception 'Tournament changed; refresh registration' using errcode='23514';end if;
 end if;
 return new;
end $$;
revoke all on function public.rock_classic_registration_validate() from public,anon,authenticated;
drop trigger if exists rock_classic_registration_validate on public.rock_esports_registrations;
create trigger rock_classic_registration_validate before insert or update of classic_players,tournament_type on public.rock_esports_registrations for each row execute function public.rock_classic_registration_validate();
