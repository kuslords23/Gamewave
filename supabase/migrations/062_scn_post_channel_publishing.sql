-- Create canonical feed posts directly inside a member-owned channel.
create or replace function public.create_scn_post_channel_text_post(
  p_channel_id uuid,
  p_content text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_id uuid;
  v_name text;
  v_avatar text;
  v_content text := trim(coalesce(p_content, ''));
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if length(v_content) < 1 or length(v_content) > 10000 then
    raise exception 'Post text must be between 1 and 10000 characters';
  end if;
  if not scn_post_private.is_channel_member(p_channel_id) then
    raise exception 'Join this channel before publishing';
  end if;

  select coalesce(name, 'SCN member'), avatar
    into v_name, v_avatar
  from public.profiles
  where id = auth.uid();

  insert into public.feed_posts(user_id, user_name, user_avatar, post_type, content, description)
  values (auth.uid()::text, coalesce(v_name, 'SCN member'), v_avatar, 'text', v_content, v_content)
  returning id into v_post_id;

  insert into public.scn_post_channel_posts(channel_id, post_id, added_by)
  values (p_channel_id, v_post_id, auth.uid());

  return v_post_id;
end;
$$;
revoke all on function public.create_scn_post_channel_text_post(uuid, text) from public, anon;
grant execute on function public.create_scn_post_channel_text_post(uuid, text) to authenticated;
