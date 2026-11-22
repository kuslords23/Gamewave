-- Force channel creation and membership changes through the checked security-definer RPCs.
revoke insert on table public.scn_post_channels from authenticated;
revoke insert, update, delete on table public.scn_post_channel_members from authenticated;
revoke update on table public.scn_post_channel_posts from authenticated;
grant select on table public.scn_post_channel_members to authenticated;
grant select, insert, delete on table public.scn_post_channel_posts to authenticated;
