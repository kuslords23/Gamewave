-- Replace the SECURITY DEFINER view with a narrowly scoped public projection table.
-- This avoids exposing private columns from profiles while keeping public member pages readable.
do $scn$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'scn_post_public_profiles'
      and c.relkind = 'v'
  ) then
    execute 'drop view public.scn_post_public_profiles';
  end if;
end;
$scn$;

create table if not exists public.scn_post_public_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  name text not null default '',
  username text,
  avatar text,
  bio text,
  updated_at timestamptz not null default now()
);

alter table public.scn_post_public_profiles enable row level security;
drop policy if exists "Public KUS Post profiles are readable" on public.scn_post_public_profiles;
create policy "Public KUS Post profiles are readable"
  on public.scn_post_public_profiles for select
  using (true);

grant select on public.scn_post_public_profiles to anon, authenticated;
revoke insert, update, delete on public.scn_post_public_profiles from anon, authenticated;

insert into public.scn_post_public_profiles(id, name, username, avatar, bio, updated_at)
select id, coalesce(name, ''), username, avatar, bio, now()
from public.profiles
on conflict (id) do update
set name = excluded.name,
    username = excluded.username,
    avatar = excluded.avatar,
    bio = excluded.bio,
    updated_at = now();

create or replace function scn_post_private.sync_scn_post_public_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.scn_post_public_profiles where id = old.id;
    return old;
  end if;

  insert into public.scn_post_public_profiles(id, name, username, avatar, bio, updated_at)
  values (new.id, coalesce(new.name, ''), new.username, new.avatar, new.bio, now())
  on conflict (id) do update
  set name = excluded.name,
      username = excluded.username,
      avatar = excluded.avatar,
      bio = excluded.bio,
      updated_at = now();

  return new;
end;
$$;

revoke all on function scn_post_private.sync_scn_post_public_profile() from public, anon, authenticated;

drop trigger if exists tr_sync_scn_post_public_profile on public.profiles;
create trigger tr_sync_scn_post_public_profile
  after insert or update or delete on public.profiles
  for each row execute function scn_post_private.sync_scn_post_public_profile();

comment on table public.scn_post_public_profiles is
  'Safe public KUS Post profile projection. Private profile fields remain only in public.profiles.';
