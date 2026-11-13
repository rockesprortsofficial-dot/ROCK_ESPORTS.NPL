-- Restrict only Classic group publication data; unrelated site features keep their existing policies.
create or replace function public.rock_classic_group_owner_guard()
returns trigger language plpgsql set search_path=public as $$
declare before_groups jsonb; after_groups jsonb;
begin
 if coalesce(auth.jwt()->>'role','')='service_role' or (auth.uid() is not null and lower(coalesce(auth.jwt()->>'email',''))='rockesprorts.official@gmail.com') then return new;end if;
 select coalesce(jsonb_agg(jsonb_build_array(e->'classicDivisionId',e->'type',e->'status',e->'title',e->'dateTime',e->'date',e->'groupDivision')),'[]'::jsonb) into before_groups from jsonb_array_elements(coalesce(old.content->'tournaments','[]'::jsonb)) e where lower(trim(coalesce(e->>'type',''))) in ('classic','squad','duo','solo','scrim');
 select coalesce(jsonb_agg(jsonb_build_array(e->'classicDivisionId',e->'type',e->'status',e->'title',e->'dateTime',e->'date',e->'groupDivision')),'[]'::jsonb) into after_groups from jsonb_array_elements(coalesce(new.content->'tournaments','[]'::jsonb)) e where lower(trim(coalesce(e->>'type',''))) in ('classic','squad','duo','solo','scrim');
 if before_groups is distinct from after_groups or old.content->'classicGroupTournamentId' is distinct from new.content->'classicGroupTournamentId' then raise exception 'Only the ROCK ESPORTS Owner may change Classic Group Division' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.rock_classic_group_owner_guard() from public,anon,authenticated;
drop trigger if exists rock_classic_group_owner_guard on public.rock_esports_site;
create trigger rock_classic_group_owner_guard before update of content on public.rock_esports_site for each row execute function public.rock_classic_group_owner_guard();
