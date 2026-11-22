-- Group joining must be authenticated; public membership predicates remain read-only.
revoke all on function public.join_scn_post_group(uuid, text) from public, anon;
grant execute on function public.join_scn_post_group(uuid, text) to authenticated;
