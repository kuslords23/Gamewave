# SCN Post
Dedicated social publishing and community companion for Sport-Clan-Nexus.

## First port
- Reads and writes the existing shared \`public.feed_posts\` table. No duplicate posts dataset.
- Uses SCN's existing \`kus-images\`, \`kus-videos\`, and \`kus-music\` storage buckets.
- Shares the hub auth storage key \`kus-lords-auth\`.
- Supports text, image, video, audio, and external-link posts.
- Preserves SCN hashtag and mention rendering.
- Derives Stories from image posts in the existing 24-hour window.
- Uses existing \`feed_comments\` and \`follows\` tables, including threaded replies and realtime comment updates.
- Adds per-user Likes and Saved records additively. Like counts increment/decrement the existing \`feed_posts.likes\` field without resetting legacy totals.

## Shared backend rules
Do not create a second posts table, user identity, or social graph. Do not copy posts into a new dataset. Both SCN surfaces must read the same records.

Set \`NEXT_PUBLIC_SUPABASE_URL\` and \`NEXT_PUBLIC_SUPABASE_ANON_KEY\` to the same values used by the SCN hub. No credentials are committed.

## Local development
\`\`\`bash
npm install
npm run dev
\`\`\`

The existing SCN Supabase project must contain \`feed_posts\`, \`feed_comments\`, \`follows\`, public media buckets, and threaded comment columns from the hub migration 027. Apply \`supabase/migrations/052_scn_post_social_interactions.sql\` to that same project before using Likes and Saved.

## Status
- [x] Clean repository baseline.
- [x] First port: shared feed contract, auth identity, publishing, media upload, Stories, comments, Following, Likes and Saved.
- [ ] Verify shared environment variables and live schema/RLS.
- [ ] Build/type-check and verify media upload permissions.
- [ ] Port advanced editor, creator tools, richer share workflows, profiles, groups and notifications.
- [ ] Integrate shared Royal runtime through KUS AI.
- [ ] Complete competitor research and product QA.
