-- Quote reposts are first-class feed posts that reference the canonical original post.
-- The original remains a single feed_posts row; commentary lives in the quoting member's row.
create schema if not exists scn_post_private;
revoke all on schema scn_post_private from public, anon, authenticated;

alter table public.feed_posts
  add column if not exists quoted_post_id uuid null
  references public.feed_posts(id) on delete set null;

create index if not exists feed_posts_quoted_post_idx
  on public.feed_posts(quoted_post_id, created_at desc)
  where quoted_post_id is not null;

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

      if v_author is not null and v_author <> new.user_id then
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

drop trigger if exists tr_sync_scn_quote_repost on public.feed_posts;
create trigger tr_sync_scn_quote_repost
  after insert or delete on public.feed_posts
  for each row execute function scn_post_private.sync_scn_quote_repost();

comment on column public.feed_posts.quoted_post_id is
  'References the canonical original post for a quote repost. Commentary remains in this feed_posts row.';
