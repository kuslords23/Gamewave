-- Tighten channel RPC execution and permit safe public-channel membership checks.
revoke all on function public.create_scn_post_channel(text, text, text) from public, anon;
revoke all on function public.join_scn_post_channel(uuid, text) from public, anon;
grant execute on function public.create_scn_post_channel(text, text, text) to authenticated;
grant execute on function public.join_scn_post_channel(uuid, text) to authenticated;

-- This helper only tests membership for auth.uid(); anonymous callers always receive false.
grant execute on function scn_post_private.is_channel_member(uuid) to anon, authenticated;
