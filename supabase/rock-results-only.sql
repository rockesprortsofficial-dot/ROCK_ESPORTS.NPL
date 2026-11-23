begin;

drop policy winner_authorized_finals on public.rock_winner_posts;
drop policy winner_editor_drafts on public.rock_winner_drafts;
create policy winner_editor_results_drafts on public.rock_winner_drafts for all to authenticated
  using (stage = 'results' and (select public.rock_winners_can_edit()))
  with check (stage = 'results' and (select public.rock_winners_can_edit()));

create or replace function rock_winners_private.publish_post(post_id uuid, expected_revision integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  draft public.rock_winner_drafts;
begin
  if not public.rock_winners_can_edit() then
    raise exception 'Publishing permission required' using errcode = '42501';
  end if;
  select * into draft from public.rock_winner_drafts where id = post_id for update;
  if not found or draft.stage <> 'results' or draft.revision <> expected_revision then
    raise exception 'Draft changed. Reopen it and try again.';
  end if;
  if draft.tournament_date is null or btrim(draft.tournament_name) = '' or exists (
    select 1 from jsonb_array_elements(draft.winners) item
    where not rock_winners_private.valid_entry(item, true)
  ) or (draft.mvp is not null and not rock_winners_private.valid_entry(draft.mvp, draft.mode = 'tdm')) then
    raise exception 'Enter the date and complete all four placements and any MVP fields.';
  end if;
  insert into public.rock_winner_posts(id, stage, mode, tournament_name, tournament_date, tournament_format, participant_count, maps, winners, mvp)
  values (
    draft.id, draft.stage, draft.mode, draft.tournament_name, draft.tournament_date,
    draft.tournament_format, draft.participant_count, draft.maps,
    (select jsonb_agg(jsonb_build_object('name', item->>'name', 'prize', item->>'prize',
      'photo', item->>'photo', 'logo', item->>'logo') order by position)
      from jsonb_array_elements(draft.winners) with ordinality as entries(item, position)),
    case when draft.mvp is not null then jsonb_build_object('name', draft.mvp->>'name',
      'prize', draft.mvp->>'prize', 'photo', draft.mvp->>'photo',
      'logo', case when draft.mode = 'tdm' then draft.mvp->>'logo' end) end
  )
  on conflict (id) do update set tournament_date = excluded.tournament_date,
    tournament_name = excluded.tournament_name, tournament_format = excluded.tournament_format,
    participant_count = excluded.participant_count, maps = excluded.maps,
    deleted_at = null, winners = excluded.winners, mvp = excluded.mvp
  where rock_winner_posts.stage = excluded.stage and rock_winner_posts.mode = excluded.mode;
  if not found then raise exception 'A published post must stay in its original section.'; end if;
end;
$$;

create or replace function rock_winners_private.manage_post(post_id uuid, action text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.rock_winners_can_edit() then
    raise exception 'Publishing permission required' using errcode = '42501';
  end if;
  if action not in ('story', 'highlight', 'remove_highlight', 'delete') then
    raise exception 'Action unavailable';
  end if;
  update public.rock_winner_posts set
    story_at = case when action = 'story' then now() when action = 'delete' then null else story_at end,
    story_highlight = case when action = 'highlight' then true
      when action in ('remove_highlight', 'delete') then false else story_highlight end,
    deleted_at = case when action = 'delete' then now() else deleted_at end
  where id = post_id and stage = 'results' and deleted_at is null and (action <> 'highlight' or story_at is not null);
  if not found then raise exception 'Post or published story unavailable'; end if;
end;
$$;

create or replace function rock_winners_private.interact(
  target_post uuid, action text, visitor_id uuid, guest_name text, body text, comment_id bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  editor boolean := public.rock_winners_can_edit();
begin
  if action <> 'read' then
    perform pg_advisory_xact_lock(hashtextextended(target_post::text, 317));
  end if;
  if not exists (select 1 from public.rock_winner_posts where id = target_post
    and deleted_at is null and stage = 'results') then
    raise exception 'Post unavailable';
  end if;
  if action in ('like', 'comment') then
    if visitor_id is null then raise exception 'Visitor ID required'; end if;
    if action = 'like' and exists (select 1 from rock_winners_private.events
      where post_id = target_post and visitor = visitor_id and kind = 'like') then
      return jsonb_build_object('ok', true);
    end if;
    if (select count(*) from rock_winners_private.events where post_id = target_post and kind = action
        and created_at > now() - interval '1 minute') >= (case when action = 'like' then 120 else 20 end) then
      raise exception 'Too many requests. Try again shortly.';
    end if;
    if action = 'comment' then
      guest_name := btrim(guest_name);
      body := btrim(body);
      if coalesce(char_length(guest_name), 0) not between 1 and 32
        or coalesce(char_length(body), 0) not between 1 and 240
        or body ~* '(https?://|www[.])'
        or guest_name ~ '[[:cntrl:]]' or body ~ '[[:cntrl:]]' then
        raise exception 'Use a short name and a comment up to 240 characters.';
      end if;
      if exists (select 1 from rock_winners_private.events where post_id = target_post
        and visitor = visitor_id and kind = 'comment' and created_at > now() - interval '30 seconds')
        or (select count(*) from rock_winners_private.events where post_id = target_post
          and kind = 'comment' and state = 'pending') >= 100 then
        raise exception 'Comments are temporarily limited. Try again later.';
      end if;
    else
      guest_name := null;
      body := null;
    end if;
    insert into rock_winners_private.events(post_id, visitor, kind, display_name, message)
      values (target_post, visitor_id, action, guest_name, body);
    return jsonb_build_object('ok', true);
  elsif action = 'delete_comment' and public.rock_finance_is_owner() then
    delete from rock_winners_private.events
      where post_id = target_post and id = comment_id and kind = 'comment';
    if not found then raise exception 'Comment unavailable'; end if;
    return jsonb_build_object('ok', true);
  elsif (action = 'approve' and editor) or (action = 'hide' and public.rock_finance_is_owner()) then
    update rock_winners_private.events set state = case when action = 'approve' then 'visible' else 'hidden' end
      where post_id = target_post and id = comment_id and kind = 'comment';
    if not found then raise exception 'Comment unavailable'; end if;
    return jsonb_build_object('ok', true);
  elsif action = 'read' then
    return jsonb_build_object(
      'likes', (select count(*) from rock_winners_private.events where post_id = target_post and kind = 'like'),
      'comment_count', (select count(*) from rock_winners_private.events where post_id = target_post and kind = 'comment' and state = 'visible'),
      'liked', exists (select 1 from rock_winners_private.events where post_id = target_post
        and kind = 'like' and visitor = visitor_id),
      'comments', coalesce((select jsonb_agg(to_jsonb(comment) order by comment.id desc) from (
        select id, display_name, message, state from rock_winners_private.events
        where post_id = target_post and kind = 'comment' and (state = 'visible' or (editor and state = 'pending'))
        order by (state = 'pending') desc, id desc limit 100
      ) comment), '[]'::jsonb)
    );
  end if;
  raise exception 'Action unavailable' using errcode = '42501';
end;
$$;
commit;
