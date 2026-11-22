-- Expose only a channel's member count, never its private roster, to public channel visitors.
create or replace function public.get_scn_post_channel_member_count(p_channel_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_privacy text;
  v_count integer;
begin
  select privacy into v_privacy
  from public.scn_post_channels
  where id = p_channel_id;

  if not found then return null; end if;
  if v_privacy <> 'public' and not scn_post_private.is_channel_member(p_channel_id) then
    return null;
  end if;

  select count(*)::integer into v_count
  from public.scn_post_channel_members
  where channel_id = p_channel_id;

  return v_count;
end;
$$;
revoke all on function public.get_scn_post_channel_member_count(uuid) from public;
grant execute on function public.get_scn_post_channel_member_count(uuid) to anon, authenticated;
