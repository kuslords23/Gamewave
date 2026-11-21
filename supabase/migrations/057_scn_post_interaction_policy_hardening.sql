-- Split broad ALL policies into operation-specific policies to avoid duplicate SELECT paths.
drop policy if exists "Users manage own post likes" on public.feed_post_likes;
drop policy if exists "Users insert own post likes" on public.feed_post_likes;
create policy "Users insert own post likes"
  on public.feed_post_likes for insert
  with check (auth.uid() = user_id);
drop policy if exists "Users delete own post likes" on public.feed_post_likes;
create policy "Users delete own post likes"
  on public.feed_post_likes for delete
  using (auth.uid() = user_id);

drop policy if exists "Users manage own post reposts" on public.feed_post_reposts;
drop policy if exists "Users create own post reposts" on public.feed_post_reposts;
create policy "Users create own post reposts"
  on public.feed_post_reposts for insert
  with check (auth.uid() = user_id);
drop policy if exists "Users delete own post reposts" on public.feed_post_reposts;
create policy "Users delete own post reposts"
  on public.feed_post_reposts for delete
  using (auth.uid() = user_id);
