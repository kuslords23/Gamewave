-- Allow Postgres policy expressions to invoke the private membership predicate.
-- The schema is not exposed through the Supabase REST API.
grant usage on schema scn_post_private to anon, authenticated;
grant execute on function scn_post_private.is_channel_member(uuid) to anon, authenticated;
revoke all on function public.create_scn_post_channel_text_post(uuid, text) from public, anon;
grant execute on function public.create_scn_post_channel_text_post(uuid, text) to authenticated;
