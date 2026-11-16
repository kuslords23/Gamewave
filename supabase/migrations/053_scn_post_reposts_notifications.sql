-- SCN Post repost records and activity notifications.
-- Additive only: original feed_posts remain the canonical post records.

create table if not exists public.feed_post_reposts (
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists feed_post_reposts_user_idx
  on public.feed_post_reposts(user_id, created_at desc);
create index if not exists feed_post_reposts_post_idx
  on public.feed_post_reposts(post_id, created_at desc);

alter table public.feed_post_reposts enable row level security;

drop policy if exists "Users read own post reposts" on public.feed_post_reposts;
create policy "Users read own post reposts"
  on public.feed_post_reposts for select
  using (auth.uid() = user_id);

drop policy if exists "Users manage own post reposts" on public.feed_post_reposts;
create policy "Users manage own post reposts"
  on public.feed_post_reposts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.sync_feed_post_repost_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
begin
  if tg_op = 'INSERT' then
    update public.feed_posts
      set reposts = coalesce(reposts, 0) + 1
      where id = new.post_id
      returning user_id into v_author;

    if v_author is not null and v_author <> new.user_id then
      insert into public.notifications(user_id, title, body, category, metadata)
      values (
        v_author,
        'Your post was reposted',
        'Someone shared your post with their SCN circle.',
        'repost',
        jsonb_build_object('postId', new.post_id, 'actorId', new.user_id)
      );
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    update public.feed_posts
      set reposts = greatest(0, coalesce(reposts, 0) - 1)
      where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists tr_sync_feed_post_repost_count on public.feed_post_reposts;
create trigger tr_sync_feed_post_repost_count
  after insert or delete on public.feed_post_reposts
  for each row execute function public.sync_feed_post_repost_count();

do $$
begin
  alter publication supabase_realtime add table public.feed_post_reposts;
exception when duplicate_object then null;
end $$;

-- A new comment notifies the owner of the post without duplicating comment data.
create or replace function public.notify_scn_post_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
begin
  select user_id into v_author from public.feed_posts where id = new.post_id;
  if v_author is not null and v_author::text <> new.user_id::text then
    insert into public.notifications(user_id, title, body, category, metadata)
    values (
      v_author,
      'New comment on your post',
      left(coalesce(new.body, ''), 180),
      'comment',
      jsonb_build_object('postId', new.post_id, 'commentId', new.id, 'actorId', new.user_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists tr_notify_scn_post_comment on public.feed_comments;
create trigger tr_notify_scn_post_comment
  after insert on public.feed_comments
  for each row execute function public.notify_scn_post_comment();
