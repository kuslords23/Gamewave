-- The shared member follow graph used by KUS Post profiles and the Following feed.
create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null,
  target_id text not null,
  target_name text not null default '',
  target_avatar text not null default '👑',
  created_at timestamptz not null default now(),
  primary key (follower_id, target_type, target_id),
  check (length(trim(target_type)) between 1 and 40),
  check (length(trim(target_id)) between 1 and 160)
);

create index if not exists follows_target_idx
  on public.follows(target_type, target_id, created_at desc);
create index if not exists follows_follower_idx
  on public.follows(follower_id, target_type, created_at desc);

alter table public.follows enable row level security;
drop policy if exists "SCN member follows are publicly readable" on public.follows;
create policy "SCN member follows are publicly readable"
  on public.follows for select using (true);
drop policy if exists "Members manage their own follows" on public.follows;
create policy "Members manage their own follows"
  on public.follows for insert with check (auth.uid() = follower_id);
drop policy if exists "Members remove their own follows" on public.follows;
create policy "Members remove their own follows"
  on public.follows for delete using (auth.uid() = follower_id);

grant select on public.follows to anon, authenticated;
grant insert, delete on public.follows to authenticated;

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

grant select on public.feed_post_reposts to authenticated;
grant insert, delete on public.feed_post_reposts to authenticated;

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


revoke all on function public.sync_feed_post_repost_count() from public, anon, authenticated;
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


revoke all on function public.notify_scn_post_comment() from public, anon, authenticated;
drop trigger if exists tr_notify_scn_post_comment on public.feed_comments;
create trigger tr_notify_scn_post_comment
  after insert on public.feed_comments
  for each row execute function public.notify_scn_post_comment();

-- Likes notify the owner while the existing 052 trigger remains responsible for counts.
create or replace function public.notify_scn_post_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
begin
  select user_id into v_author from public.feed_posts where id = new.post_id;
  if v_author is not null and v_author <> new.user_id then
    insert into public.notifications(user_id, title, body, category, metadata)
    values (
      v_author,
      'Someone liked your post',
      'Your post received a new like.',
      'like',
      jsonb_build_object('postId', new.post_id, 'actorId', new.user_id)
    );
  end if;
  return new;
end;
$$;


revoke all on function public.notify_scn_post_like() from public, anon, authenticated;
drop trigger if exists tr_notify_scn_post_like on public.feed_post_likes;
create trigger tr_notify_scn_post_like
  after insert on public.feed_post_likes
  for each row execute function public.notify_scn_post_like();

-- User follows create notifications for the followed profile.
create or replace function public.notify_scn_post_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid;
begin
  if new.target_type <> 'user' then return new; end if;
  begin
    v_target := new.target_id::uuid;
  exception when invalid_text_representation then
    return new;
  end;
  if v_target is not null and v_target <> new.follower_id then
    insert into public.notifications(user_id, title, body, category, metadata)
    values (
      v_target,
      'New follower',
      'Someone started following your profile.',
      'follow',
      jsonb_build_object('followerId', new.follower_id, 'targetId', new.target_id)
    );
  end if;
  return new;
end;
$$;


revoke all on function public.notify_scn_post_follow() from public, anon, authenticated;
drop trigger if exists tr_notify_scn_post_follow on public.follows;
create trigger tr_notify_scn_post_follow
  after insert on public.follows
  for each row execute function public.notify_scn_post_follow();
