-- SCN Post communities backed by the shared SCN chat conversation store.

create table if not exists public.scn_post_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 64),
  description text not null default '',
  privacy text not null default 'public' check (privacy in ('public', 'private')),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  conversation_id text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.scn_post_group_members (
  group_id uuid not null references public.scn_post_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'moderator', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists scn_post_groups_created_idx on public.scn_post_groups(created_at desc);
create index if not exists scn_post_group_members_user_idx on public.scn_post_group_members(user_id, joined_at desc);

alter table public.scn_post_groups enable row level security;
alter table public.scn_post_group_members enable row level security;

create or replace function public.is_scn_post_group_member(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $
  select exists (
    select 1 from public.scn_post_group_members
    where group_id = p_group_id and user_id = auth.uid()
  );
$;

revoke all on function public.is_scn_post_group_member(uuid) from public;
grant execute on function public.is_scn_post_group_member(uuid) to anon, authenticated;

drop policy if exists "SCN Post public groups and memberships are visible" on public.scn_post_groups;
create policy "SCN Post public groups and memberships are visible"
  on public.scn_post_groups for select
  using (privacy = 'public' or owner_id = auth.uid() or public.is_scn_post_group_member(id));

drop policy if exists "SCN Post owners update groups" on public.scn_post_groups;
create policy "SCN Post owners update groups"
  on public.scn_post_groups for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "SCN Post owners delete groups" on public.scn_post_groups;
create policy "SCN Post owners delete groups"
  on public.scn_post_groups for delete
  using (owner_id = auth.uid());

drop policy if exists "SCN Post members see their group roster" on public.scn_post_group_members;
create policy "SCN Post members see their group roster"
  on public.scn_post_group_members for select
  using (user_id = auth.uid() or public.is_scn_post_group_member(group_id));

grant select on public.scn_post_groups to anon, authenticated;
grant update, delete on public.scn_post_groups to authenticated;
grant select on public.scn_post_group_members to authenticated;

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

  insert into public.scn_post_groups(owner_id, name, description, privacy, invite_code, conversation_id)
  values (auth.uid(), trim(p_name), left(coalesce(trim(p_description), ''), 500), coalesce(p_privacy, 'public'), v_invite_code, v_conversation_id);

  insert into public.scn_post_group_members(group_id, user_id, role)
  values (v_id, auth.uid(), 'owner');

  insert into public.conversation_members(conversation_id, user_id)
  values (v_conversation_id, auth.uid())
  on conflict (conversation_id, user_id) do nothing;

  return query select v_id, v_conversation_id, v_invite_code;
end;
$$;

create or replace function public.join_scn_post_group(
  p_group_id uuid,
  p_invite_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.scn_post_groups%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_group from public.scn_post_groups where scn_post_groups.id = p_group_id;
  if not found then raise exception 'Group not found'; end if;

  if v_group.privacy = 'private'
    and upper(coalesce(trim(p_invite_code), '')) <> v_group.invite_code then
    raise exception 'A valid invite code is required for this private group';
  end if;

  insert into public.scn_post_group_members(group_id, user_id, role)
  values (v_group.id, auth.uid(), case when v_group.owner_id = auth.uid() then 'owner' else 'member' end)
  on conflict (group_id, user_id) do nothing;

  insert into public.conversation_members(conversation_id, user_id)
  values (v_group.conversation_id, auth.uid())
  on conflict (conversation_id, user_id) do nothing;

  return true;
end;
$$;

revoke all on function public.create_scn_post_group(text, text, text) from public;
revoke all on function public.join_scn_post_group(uuid, text) from public;
grant execute on function public.create_scn_post_group(text, text, text) to authenticated;
grant execute on function public.join_scn_post_group(uuid, text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.scn_post_groups;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.scn_post_group_members;
exception when duplicate_object then null;
end $$;
