-- feed_posts.user_id is text in the shared SCN feed; compare normalized identifiers.
create or replace function scn_post_private.sync_scn_quote_repost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
begin
  if tg_op = 'INSERT' then
    if new.quoted_post_id is not null then
      update public.feed_posts
        set reposts = coalesce(reposts, 0) + 1
        where id = new.quoted_post_id
        returning user_id into v_author;

      if v_author is not null and v_author::text <> new.user_id::text then
        insert into public.notifications(user_id, title, body, category, metadata)
        values (
          v_author,
          'Your post was quoted',
          'Someone added their perspective to your post.',
          'repost',
          jsonb_build_object('postId', new.quoted_post_id, 'quotePostId', new.id, 'actorId', new.user_id)
        );
      end if;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.quoted_post_id is not null then
      update public.feed_posts
        set reposts = greatest(0, coalesce(reposts, 0) - 1)
        where id = old.quoted_post_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

revoke all on function scn_post_private.sync_scn_quote_repost() from public, anon, authenticated;
