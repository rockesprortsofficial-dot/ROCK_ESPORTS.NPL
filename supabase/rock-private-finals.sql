begin;

drop policy winner_public_posts on public.rock_winner_posts;
create policy winner_public_results on public.rock_winner_posts for select to anon, authenticated
  using (deleted_at is null and stage = 'results');
create policy winner_authorized_finals on public.rock_winner_posts for select to authenticated
  using (deleted_at is null and stage = 'finals' and (select public.rock_winners_can_edit()));

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
    and deleted_at is null and (stage = 'results' or editor)) then
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
  elsif action in ('approve', 'hide') and editor then
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
