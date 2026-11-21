-- Public member profile projection with only fields intended for discovery and profile pages.
-- Keep private fields such as email and location in public.profiles, not this table.
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
comment on table public.scn_post_public_profiles is
  'Safe public KUS Post profile projection. Private profile fields are intentionally excluded.';
