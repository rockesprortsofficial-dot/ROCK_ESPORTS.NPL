begin;
create table if not exists public.rock_meeting_recordings (
 id uuid primary key default gen_random_uuid(),meeting_id uuid not null references public.rock_meetings(id),
 path text not null unique,name text not null,bytes bigint not null check(bytes>0 and bytes<=26214400),created_at timestamptz not null default now()
);
alter table public.rock_meeting_recordings enable row level security;
revoke all on public.rock_meeting_recordings from anon,authenticated;
grant all on public.rock_meeting_recordings to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('rock-meeting-recordings','rock-meeting-recordings',false,26214400,array['video/webm','video/mp4','video/x-matroska'])
on conflict(id) do nothing;
create or replace function public.rock_meeting_reserve_recording(p_meeting uuid,p_path text,p_name text,p_bytes bigint)
returns uuid language plpgsql security definer set search_path=public as $$
declare recording_id uuid;
begin
 perform pg_advisory_xact_lock(937211);
 if p_bytes<=0 or p_bytes>26214400 or coalesce((select sum(bytes) from public.rock_meeting_recordings),0)+p_bytes>104857600 then
  raise exception 'Recording library is full or the file exceeds 25 MB';
 end if;
 insert into public.rock_meeting_recordings(meeting_id,path,name,bytes) values(p_meeting,p_path,p_name,p_bytes) returning id into recording_id;
 return recording_id;
end $$;
revoke all on function public.rock_meeting_reserve_recording(uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.rock_meeting_reserve_recording(uuid,text,text,bigint) to service_role;
commit;
