-- Separate sessions: never alter Tournament, Meeting Room or membership data.
begin;
create table public.rock_broadcast_social_sessions(
 id uuid primary key default gen_random_uuid(),mode text not null check(mode in ('gameplay','watchparty')),
 owner_id uuid not null references auth.users(id),created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '6 hours',ended boolean not null default false,
 invite_hash text not null check(length(invite_hash)=64),join_open boolean not null default true,
 blocked text[] not null default '{}',live boolean not null default false,
 egress_id text,egress_state text not null default 'idle'
);
create unique index rock_broadcast_social_one_per_mode on public.rock_broadcast_social_sessions(mode) where not ended;
alter table public.rock_broadcast_social_sessions enable row level security;
revoke all on public.rock_broadcast_social_sessions from public,anon,authenticated;
grant select,insert,update on public.rock_broadcast_social_sessions to service_role;
commit;
