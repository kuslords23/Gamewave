-- KUS Post profile expansion, public-safe profile projections, and publishing channels.
create schema if not exists scn_post_private;

create table if not exists public.scn_post_profile_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cover_url text,
  details jsonb not null default '{}'::jsonb,
  visibility jsonb not null default '{"cover":"public","website":"public"}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.scn_post_profile_details enable row level security;
drop policy if exists "Users manage their own KUS Post profile details" on public.scn_post_profile_details;
create policy "Users manage their own KUS Post profile details"
  on public.scn_post_profile_details for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.scn_post_profile_details to authenticated;

create table if not exists public.scn_post_public_profile_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cover_url text,
  details jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.scn_post_public_profile_details enable row level security;
drop policy if exists "Public KUS Post profile details are readable" on public.scn_post_public_profile_details;
create policy "Public KUS Post profile details are readable"
  on public.scn_post_public_profile_details for select to anon, authenticated
  using (true);
grant select on public.scn_post_public_profile_details to anon, authenticated;
revoke insert, update, delete on public.scn_post_public_profile_details from anon, authenticated;

create table if not exists public.scn_post_followers_profile_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cover_url text,
  details jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.scn_post_followers_profile_details enable row level security;
drop policy if exists "Profile details visible to owner and followers" on public.scn_post_followers_profile_details;
create policy "Profile details visible to owner and followers"
  on public.scn_post_followers_profile_details for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.follows f
      where f.follower_id = (select auth.uid())
        and f.target_type = 'user'
        and f.target_id = scn_post_followers_profile_details.user_id::text
    )
  );
grant select on public.scn_post_followers_profile_details to authenticated;
revoke insert, update, delete on public.scn_post_followers_profile_details from anon, authenticated;

create or replace function scn_post_private.sync_profile_details_projections()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_public jsonb := '{}'::jsonb;
  v_followers jsonb := '{}'::jsonb;
  v_public_cover text;
  v_followers_cover text;
begin
  if tg_op = 'DELETE' then
    delete from public.scn_post_public_profile_details where user_id = old.user_id;
    delete from public.scn_post_followers_profile_details where user_id = old.user_id;
    return old;
  end if;

  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    into v_public
  from jsonb_each(coalesce(new.details, '{}'::jsonb)) e
  where coalesce(new.visibility ->> e.key, 'private') = 'public';

  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    into v_followers
  from jsonb_each(coalesce(new.details, '{}'::jsonb)) e
  where coalesce(new.visibility ->> e.key, 'private') in ('public', 'followers');

  v_public_cover := case when coalesce(new.visibility ->> 'cover', 'private') = 'public' then new.cover_url else null end;
  v_followers_cover := case when coalesce(new.visibility ->> 'cover', 'private') in ('public', 'followers') then new.cover_url else null end;

  insert into public.scn_post_public_profile_details(user_id, cover_url, details, updated_at)
  values (new.user_id, v_public_cover, v_public, now())
  on conflict (user_id) do update
    set cover_url = excluded.cover_url, details = excluded.details, updated_at = now();

  insert into public.scn_post_followers_profile_details(user_id, cover_url, details, updated_at)
  values (new.user_id, v_followers_cover, v_followers, now())
  on conflict (user_id) do update
    set cover_url = excluded.cover_url, details = excluded.details, updated_at = now();

  new.updated_at := now();
  return new;
end;
$$;
revoke all on function scn_post_private.sync_profile_details_projections() from public, anon, authenticated;
drop trigger if exists tr_scn_post_profile_details_projection on public.scn_post_profile_details;
create trigger tr_scn_post_profile_details_projection
  before insert or update or delete on public.scn_post_profile_details
  for each row execute function scn_post_private.sync_profile_details_projections();

create table if not exists public.scn_post_channels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 64),
  description text not null default '',
  privacy text not null default 'public' check (privacy in ('public', 'private')),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  avatar_url text,
  created_at timestamptz not null default now()
);
create table if not exists public.scn_post_channel_members (
  channel_id uuid not null references public.scn_post_channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);
create table if not exists public.scn_post_channel_posts (
  channel_id uuid not null references public.scn_post_channels(id) on delete cascade,
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  added_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (channel_id, post_id)
);
create index if not exists scn_post_channels_created_idx on public.scn_post_channels(created_at desc);
create index if not exists scn_post_channel_members_user_idx on public.scn_post_channel_members(user_id, joined_at desc);
create index if not exists scn_post_channel_posts_created_idx on public.scn_post_channel_posts(channel_id, created_at desc);

alter table public.scn_post_channels enable row level security;
alter table public.scn_post_channel_members enable row level security;
alter table public.scn_post_channel_posts enable row level security;

create or replace function scn_post_private.is_channel_member(p_channel_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.scn_post_channel_members m
    where m.channel_id = p_channel_id and m.user_id = auth.uid()
  );
$$;
revoke all on function scn_post_private.is_channel_member(uuid) from public, anon;
grant execute on function scn_post_private.is_channel_member(uuid) to authenticated;

drop policy if exists "SCN Post channels are visible to members and public" on public.scn_post_channels;
create policy "SCN Post channels are visible to members and public"
  on public.scn_post_channels for select to anon, authenticated
  using (privacy = 'public' or owner_id = (select auth.uid()) or scn_post_private.is_channel_member(id));
drop policy if exists "SCN Post channel owners create channels" on public.scn_post_channels;
create policy "SCN Post channel owners create channels"
  on public.scn_post_channels for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists "SCN Post channel owners update channels" on public.scn_post_channels;
create policy "SCN Post channel owners update channels"
  on public.scn_post_channels for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
drop policy if exists "SCN Post channel owners delete channels" on public.scn_post_channels;
create policy "SCN Post channel owners delete channels"
  on public.scn_post_channels for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "SCN Post channel rosters visible to members" on public.scn_post_channel_members;
create policy "SCN Post channel rosters visible to members"
  on public.scn_post_channel_members for select to authenticated
  using (user_id = (select auth.uid()) or scn_post_private.is_channel_member(channel_id));

drop policy if exists "SCN Post channel posts visible to channel members" on public.scn_post_channel_posts;
create policy "SCN Post channel posts visible to channel members"
  on public.scn_post_channel_posts for select to anon, authenticated
  using (
    exists (
      select 1 from public.scn_post_channels c
      where c.id = channel_id
        and (c.privacy = 'public' or c.owner_id = (select auth.uid()) or scn_post_private.is_channel_member(c.id))
    )
  );
drop policy if exists "SCN Post channel members share canonical posts" on public.scn_post_channel_posts;
create policy "SCN Post channel members share canonical posts"
  on public.scn_post_channel_posts for insert to authenticated
  with check (added_by = (select auth.uid()) and scn_post_private.is_channel_member(channel_id));
drop policy if exists "SCN Post channel owners and sharers remove posts" on public.scn_post_channel_posts;
create policy "SCN Post channel owners and sharers remove posts"
  on public.scn_post_channel_posts for delete to authenticated
  using (
    added_by = (select auth.uid())
    or exists (select 1 from public.scn_post_channels c where c.id = channel_id and c.owner_id = (select auth.uid()))
  );

grant select, insert, update, delete on public.scn_post_channels to authenticated;
grant select on public.scn_post_channels to anon;
grant select on public.scn_post_channel_members to authenticated;
grant select, insert, delete on public.scn_post_channel_posts to authenticated;
grant select on public.scn_post_channel_posts to anon;

create or replace function public.create_scn_post_channel(
  p_name text,
  p_description text default '',
  p_privacy text default 'public'
)
returns table(id uuid, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(p_name)) > 64 then
    raise exception 'Channel name must be between 2 and 64 characters';
  end if;
  if coalesce(p_privacy, 'public') not in ('public', 'private') then
    raise exception 'Invalid channel privacy';
  end if;
  v_id := gen_random_uuid();
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.scn_post_channels(owner_id, name, description, privacy, invite_code)
  values (auth.uid(), trim(p_name), left(coalesce(trim(p_description), ''), 500), coalesce(p_privacy, 'public'), v_code);
  insert into public.scn_post_channel_members(channel_id, user_id, role)
  values (v_id, auth.uid(), 'owner');
  return query select v_id, v_code;
end;
$$;

create or replace function public.join_scn_post_channel(
  p_channel_id uuid,
  p_invite_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel public.scn_post_channels%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_channel from public.scn_post_channels where scn_post_channels.id = p_channel_id;
  if not found then raise exception 'Channel not found'; end if;
  if v_channel.privacy = 'private'
    and upper(coalesce(trim(p_invite_code), '')) <> v_channel.invite_code then
    raise exception 'A valid invite code is required for this private channel';
  end if;
  insert into public.scn_post_channel_members(channel_id, user_id, role)
  values (v_channel.id, auth.uid(), case when v_channel.owner_id = auth.uid() then 'owner' else 'member' end)
  on conflict (channel_id, user_id) do nothing;
  return true;
end;
$$;
revoke all on function public.create_scn_post_channel(text, text, text) from public;
revoke all on function public.join_scn_post_channel(uuid, text) from public;
grant execute on function public.create_scn_post_channel(text, text, text) to authenticated;
grant execute on function public.join_scn_post_channel(uuid, text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.scn_post_profile_details;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.scn_post_channels;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.scn_post_channel_members;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.scn_post_channel_posts;
exception when duplicate_object then null;
end $$;
