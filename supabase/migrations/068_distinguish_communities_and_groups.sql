-- Distinguish communities from groups while keeping one shared membership/conversation system.
alter table public.scn_post_groups
  add column if not exists space_type text not null default 'group';

alter table public.scn_post_groups
  drop constraint if exists scn_post_groups_space_type_check;
alter table public.scn_post_groups
  add constraint scn_post_groups_space_type_check
  check (space_type in ('group', 'community'));

-- Fix the existing group creator: it previously generated an ID but did not insert that ID,
-- leaving the owner membership and conversation linked to a different/nonexistent group ID.
create or replace function public.create_scn_post_group(
  p_name text,
  p_description text default '',
  p_privacy text default 'public'
)
returns table(id uuid, conversation_id text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_conversation_id text;
  v_invite_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(p_name)) > 64 then
    raise exception 'Group name must be between 2 and 64 characters';
  end if;
  if coalesce(p_privacy, 'public') not in ('public', 'private') then
    raise exception 'Invalid group privacy';
  end if;

  v_id := gen_random_uuid();
  v_conversation_id := 'scn-group-' || v_id::text;
  v_invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into public.scn_post_groups(id, owner_id, name, description, privacy, invite_code, conversation_id, space_type)
  values (v_id, auth.uid(), trim(p_name), left(coalesce(trim(p_description), ''), 500), coalesce(p_privacy, 'public'), v_invite_code, v_conversation_id, 'group');

  insert into public.scn_post_group_members(group_id, user_id, role)
  values (v_id, auth.uid(), 'owner');

  insert into public.conversation_members(conversation_id, user_id)
  values (v_conversation_id, auth.uid())
  on conflict (conversation_id, user_id) do nothing;

  return query select v_id, v_conversation_id, v_invite_code;
end;
$$;

create or replace function public.create_scn_post_community(
  p_name text,
  p_description text default '',
  p_privacy text default 'public'
)
returns table(id uuid, conversation_id text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_conversation_id text;
  v_invite_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(p_name)) > 64 then
    raise exception 'Community name must be between 2 and 64 characters';
  end if;
  if coalesce(p_privacy, 'public') not in ('public', 'private') then
    raise exception 'Invalid community privacy';
  end if;

  v_id := gen_random_uuid();
  v_conversation_id := 'scn-community-' || v_id::text;
  v_invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into public.scn_post_groups(id, owner_id, name, description, privacy, invite_code, conversation_id, space_type)
  values (v_id, auth.uid(), trim(p_name), left(coalesce(trim(p_description), ''), 500), coalesce(p_privacy, 'public'), v_invite_code, v_conversation_id, 'community');

  insert into public.scn_post_group_members(group_id, user_id, role)
  values (v_id, auth.uid(), 'owner');

  insert into public.conversation_members(conversation_id, user_id)
  values (v_conversation_id, auth.uid())
  on conflict (conversation_id, user_id) do nothing;

  return query select v_id, v_conversation_id, v_invite_code;
end;
$$;

revoke all on function public.create_scn_post_group(text, text, text) from public, anon;
revoke all on function public.create_scn_post_community(text, text, text) from public, anon;
grant execute on function public.create_scn_post_group(text, text, text) to authenticated;
grant execute on function public.create_scn_post_community(text, text, text) to authenticated;

revoke insert on table public.scn_post_groups from authenticated;
revoke insert, update, delete on table public.scn_post_group_members from authenticated;
grant select on table public.scn_post_group_members to authenticated;
