-- Tighten legacy group table grants to match the guarded RPC workflow.
revoke all on table public.scn_post_groups from public;
revoke insert on table public.scn_post_groups from anon, authenticated;
grant select on table public.scn_post_groups to anon, authenticated;
grant update, delete on table public.scn_post_groups to authenticated;

revoke all on table public.scn_post_group_members from public, anon;
revoke insert, update, delete on table public.scn_post_group_members from authenticated;
grant select on table public.scn_post_group_members to authenticated;
