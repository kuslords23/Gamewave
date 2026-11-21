-- Public member profiles are a safe projection, not unrestricted reads of profiles.
-- The source table also contains private fields such as email and location.
create or replace view public.scn_post_public_profiles
with (security_barrier = true)
as
select id, name, username, avatar, bio
from public.profiles;

grant select on public.scn_post_public_profiles to anon, authenticated;

comment on view public.scn_post_public_profiles is
  'Public KUS Post member profile fields only. Private profile fields are intentionally excluded.';
