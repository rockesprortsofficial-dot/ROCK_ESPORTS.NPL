begin;
create table public.rock_gameplay_youtube_settings (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 encrypted text not null
);
alter table public.rock_gameplay_youtube_settings enable row level security;
revoke all on public.rock_gameplay_youtube_settings from public, anon, authenticated;
grant select, insert, update on public.rock_gameplay_youtube_settings to service_role;
commit;
