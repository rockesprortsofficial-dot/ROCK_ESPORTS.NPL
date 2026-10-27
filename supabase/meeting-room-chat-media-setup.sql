-- ROCK ESPORTS Meeting Room chat and private media setup
create extension if not exists pgcrypto;

create table if not exists public.rock_meeting_messages (
  id uuid primary key default gen_random_uuid(),
  room_name text not null,
  sender_id text not null,
  sender_name text not null,
  message text not null default '',
  media_path text,
  media_type text,
  created_at timestamptz not null default now(),
  constraint rock_meeting_messages_content check (
    length(trim(message)) > 0 or media_path is not null
  ),
  constraint rock_meeting_messages_message_length check (char_length(message) <= 2000)
);

create index if not exists rock_meeting_messages_room_created_idx
  on public.rock_meeting_messages (room_name, created_at desc);

alter table public.rock_meeting_messages enable row level security;
-- No public/anon policies: only the verified Edge Function service role can read/write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rock-meeting-media',
  'rock-meeting-media',
  false,
  26214400,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
