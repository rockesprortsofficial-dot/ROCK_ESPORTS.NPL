begin;
create table if not exists public.rock_meetings (
 id uuid primary key default gen_random_uuid(),host_id uuid not null references auth.users(id),title text not null check(char_length(title) between 2 and 80),
 password_hash text not null,locked boolean not null default false,restricted boolean not null default false,ended boolean not null default false,
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '24 hours'
);
alter table public.rock_meetings enable row level security;
revoke all on public.rock_meetings from anon,authenticated;
grant all on public.rock_meetings to service_role;
create index if not exists rock_meetings_host_created on public.rock_meetings(host_id,created_at desc);
commit;
