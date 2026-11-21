-- Additive SCN Post interactions. Existing posts remain in public.feed_posts.
create table if not exists public.feed_post_likes(post_id uuid not null references public.feed_posts(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),primary key(post_id,user_id));
create index if not exists feed_post_likes_user_idx on public.feed_post_likes(user_id,created_at desc);
alter table public.feed_post_likes enable row level security;
drop policy if exists "Anyone can read post likes" on public.feed_post_likes;
create policy "Anyone can read post likes" on public.feed_post_likes for select using(true);
drop policy if exists "Users manage own post likes" on public.feed_post_likes;
create policy "Users manage own post likes" on public.feed_post_likes for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create or replace function public.sync_feed_post_like_count() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then update public.feed_posts set likes=coalesce(likes,0)+1 where id=new.post_id; return new;
 elsif tg_op='DELETE' then update public.feed_posts set likes=greatest(0,coalesce(likes,0)-1) where id=old.post_id; return old; end if;
 return null;
end; $$;
drop trigger if exists tr_sync_feed_post_like_count on public.feed_post_likes;
create trigger tr_sync_feed_post_like_count after insert or delete on public.feed_post_likes for each row execute function public.sync_feed_post_like_count();
grant select on public.feed_post_likes to anon, authenticated;
grant insert, delete on public.feed_post_likes to authenticated;

create table if not exists public.feed_post_saves(post_id uuid not null references public.feed_posts(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),primary key(post_id,user_id));
create index if not exists feed_post_saves_user_idx on public.feed_post_saves(user_id,created_at desc);
alter table public.feed_post_saves enable row level security;
drop policy if exists "Users manage own post saves" on public.feed_post_saves;
create policy "Users manage own post saves" on public.feed_post_saves for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
grant select, insert, delete on public.feed_post_saves to authenticated;

do $scn$ begin alter publication supabase_realtime add table public.feed_post_likes; exception when duplicate_object then null; end $scn$;
