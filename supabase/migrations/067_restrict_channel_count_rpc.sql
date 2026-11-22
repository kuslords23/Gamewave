-- Channel member counts are not sensitive to signed-in members, but keep the definer RPC off the anonymous API.
revoke all on function public.get_scn_post_channel_member_count(uuid) from public, anon;
grant execute on function public.get_scn_post_channel_member_count(uuid) to authenticated;
