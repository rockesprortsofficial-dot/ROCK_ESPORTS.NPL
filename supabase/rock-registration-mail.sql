begin;
create schema rock_registration_mail_private;
revoke all on schema rock_registration_mail_private from public;
create table rock_registration_mail_private.campaigns (
  id uuid primary key,
  owner_id uuid not null,
  subject text not null,
  message text not null,
  sender text not null,
  recipients text[] not null,
  sent integer not null default 0,
  processed integer not null default 0 check (processed between 0 and cardinality(recipients)),
  in_flight_at timestamptz,
  check (sent between 0 and processed),
  prepared_at timestamptz not null default now()
);
alter table rock_registration_mail_private.campaigns enable row level security;

create function rock_registration_mail_private.recipient_list() returns text[]
language sql stable set search_path = '' as $$
  select coalesce(array_agg(email order by email), array[]::text[]) from (
    select distinct lower(btrim(email)) as email
    from public.rock_esports_registrations
    where char_length(btrim(email)) between 3 and 254
      and btrim(email) ~ '^[[:alnum:]_.+%-]+@[[:alnum:]-]+([.][[:alnum:]-]+)+$'
  ) addresses;
$$;
revoke all on function rock_registration_mail_private.recipient_list() from public;

create function public.rock_registration_mail_status(editor uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'total',cardinality(rock_registration_mail_private.recipient_list()),
    'pending',(select jsonb_build_object('id',id,'subject',subject,'sent',sent,'processed',processed,'total',cardinality(recipients),
      'expires_at',prepared_at + interval '23 hours')
      from rock_registration_mail_private.campaigns
      where owner_id = editor and (processed < cardinality(recipients) or in_flight_at is not null) and prepared_at > now() - interval '23 hours'
      order by prepared_at desc limit 1));
$$;

create function public.rock_registration_mail_batch(campaign_id uuid, editor uuid, mail_subject text, mail_message text, mail_sender text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  campaign rock_registration_mail_private.campaigns;
  emails text[];
begin
  perform pg_advisory_xact_lock(hashtextextended(editor::text, 9854));
  select * into campaign from rock_registration_mail_private.campaigns where id = campaign_id and owner_id = editor;
  if not found then
    if exists (select 1 from rock_registration_mail_private.campaigns
       where owner_id = editor and (processed < cardinality(recipients) or in_flight_at is not null) and prepared_at > now() - interval '23 hours') then
      raise exception 'Resume the existing send first';
    end if;
    if coalesce(char_length(btrim(mail_subject)),0) not between 1 and 150
      or coalesce(char_length(btrim(mail_message)),0) not between 1 and 5000 or mail_sender is null then
      raise exception 'Subject and message required';
    end if;
    emails := rock_registration_mail_private.recipient_list();
    if cardinality(emails) = 0 then raise exception 'No registered email addresses'; end if;
    insert into rock_registration_mail_private.campaigns(id,owner_id,subject,message,sender,recipients)
      values(campaign_id,editor,btrim(mail_subject),btrim(mail_message),mail_sender,emails)
      on conflict (id) do nothing;
    select * into strict campaign from rock_registration_mail_private.campaigns where id = campaign_id and owner_id = editor;
  end if;
  if (campaign.processed < cardinality(campaign.recipients) or campaign.in_flight_at is not null)
     and campaign.prepared_at <= now() - interval '23 hours' then
    raise exception 'This send has expired';
  end if;
  if campaign.in_flight_at > now() - interval '45 seconds' then
    raise exception 'This send is already in progress. Retry in a moment.';
  end if;
  if campaign.processed < cardinality(campaign.recipients) then
    update rock_registration_mail_private.campaigns set processed=processed+1, in_flight_at=now()
      where id=campaign_id returning * into campaign;
  elsif campaign.in_flight_at is not null then
    update rock_registration_mail_private.campaigns set in_flight_at=null
      where id=campaign_id returning * into campaign;
  end if;
  return jsonb_build_object('subject',campaign.subject,'message',campaign.message,'sender',campaign.sender,
    'sent',campaign.sent,'processed',campaign.processed,'total',cardinality(campaign.recipients),
    'recipient',case when campaign.in_flight_at is not null then campaign.recipients[campaign.processed] end);
end;
$$;

create function public.rock_registration_mail_ack(campaign_id uuid, editor uuid, batch_offset integer, outcome text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare campaign rock_registration_mail_private.campaigns;
begin
  if outcome not in ('sent','retry','uncertain') then raise exception 'Unknown mail result'; end if;
  update rock_registration_mail_private.campaigns
    set sent=sent+case when outcome='sent' then 1 else 0 end,
      processed=processed-case when outcome='retry' then 1 else 0 end, in_flight_at=null
    where id=campaign_id and owner_id=editor and processed=batch_offset and in_flight_at is not null;
  select * into strict campaign from rock_registration_mail_private.campaigns where id=campaign_id and owner_id=editor;
  return jsonb_build_object('sent',campaign.sent,'processed',campaign.processed,'total',cardinality(campaign.recipients));
end;
$$;
revoke all on function public.rock_registration_mail_status(uuid),
  public.rock_registration_mail_batch(uuid,uuid,text,text,text),
  public.rock_registration_mail_ack(uuid,uuid,integer,text) from public, anon, authenticated;
grant execute on function public.rock_registration_mail_status(uuid),
  public.rock_registration_mail_batch(uuid,uuid,text,text,text),
  public.rock_registration_mail_ack(uuid,uuid,integer,text) to service_role;
commit;
