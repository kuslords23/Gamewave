-- Remove Supabase default anon table grants where row policies are not intended as the boundary.
revoke all on table public.scn_post_profile_details from public, anon;
grant select, insert, update, delete on table public.scn_post_profile_details to authenticated;

revoke all on table public.scn_post_followers_profile_details from public, anon;
grant select on table public.scn_post_followers_profile_details to authenticated;

revoke all on table public.scn_post_public_profile_details from public;
revoke insert, update, delete on table public.scn_post_public_profile_details from anon, authenticated;
grant select on table public.scn_post_public_profile_details to anon, authenticated;

revoke all on table public.scn_post_channels from public;
revoke insert, update, delete on table public.scn_post_channels from anon;
grant select on table public.scn_post_channels to anon, authenticated;
grant insert, update, delete on table public.scn_post_channels to authenticated;

revoke all on table public.scn_post_channel_members from public, anon;
grant select on table public.scn_post_channel_members to authenticated;

revoke all on table public.scn_post_channel_posts from public;
revoke insert, update, delete on table public.scn_post_channel_posts from anon;
grant select on table public.scn_post_channel_posts to anon, authenticated;
grant insert, delete on table public.scn_post_channel_posts to authenticated;
