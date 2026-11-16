# SCN Post

A dedicated, mobile-first social companion for Sport-Clan-Nexus. The interface adopts Kus-Lords Music's dark, luminous visual language: near-black surfaces, deep violet glass panels, vivid pink interaction accents, warm gold highlights, rounded media cards and responsive navigation.

## Product surface

- **Social Home:** shared SCN feed, For You / Following / Explore, hashtags, mentions and 24-hour image Stories.
- **Publishing:** text, image, video, audio and external-link posts using the existing SCN media buckets.
- **Quick Video Studio:** local video preview, title, preview framing and captured cover frame. The original upload is preserved; rendered trimming/export is not claimed.
- **Friends:** discover profiles and follow/unfollow through the existing SCN social graph.
- **Reels:** vertical video viewing, likes, reposts, share links and view-count tracking.
- **Messages:** direct conversations using the shared SCN conversation IDs and membership model. Existing mutual-follow / accepted-chat-request access rules are respected.
- **Communities:** public and private groups, invite links and group conversations using the shared SCN chat message store.
- **Notifications:** reads the shared notifications table. New likes, comments, reposts and user follows generate activity notifications.
- **My Profile:** edit display name, username and avatar on the shared profile.
- **Creator Studio:** post, like, comment, repost, view and listen counters from the shared feed. Audience retention, follower-growth attribution and revenue analytics are not represented as available.
- **Royal:** uses the authenticated shared Royal gateway through a same-origin server proxy. SCN Post uses the supported `hub` companion identity; it does not create a second assistant or model runtime.

## Shared data contract

SCN Post does **not** create a second post table, profile system, social graph, or chat-message store.

- Posts remain in `public.feed_posts`.
- Comments remain in `public.feed_comments`.
- Follows remain in `public.follows`.
- Profiles remain in `public.profiles`.
- DMs and community messages remain in `public.chat_messages` with the existing `conversation_members` authorization model.
- Notifications remain in `public.notifications`.
- Media remains in `kus-images`, `kus-videos`, and `kus-music`.

## Environment

Set the same SCN Supabase project values used by the SCN Hub:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional server-side setting:

- `KUS_AI_ORIGIN` defaults to `https://kus-ai-app.vercel.app`. It must point to the canonical KUS AI deployment if that origin changes.

No service-role keys or provider credentials belong in the browser bundle or repository.

## Database setup

Apply these additive migrations to the **existing SCN Supabase project**, in order:

1. `052_scn_post_social_interactions.sql` adds per-user likes and saved posts.
2. `053_scn_post_reposts_notifications.sql` adds persistent reposts and notification triggers for likes, comments, reposts and follows.
3. `054_scn_post_communities.sql` adds public/private community metadata and secure membership RPCs.

The SCN project must already have the hub schema used by this companion, including `feed_posts`, `feed_comments`, `follows`, `profiles`, `notifications`, `chat_messages`, `conversation_members`, the threaded-comment columns from the hub migration, the view/listen counter RPCs and the three media buckets. The community migration depends on the `conversation_members` model established by SCN's production chat schema.

Do not apply these migrations to a new, separate SCN Post Supabase project. The shared data boundary is intentional.

## Local development

```bash
npm install
npm run dev
```

## Verification and deployment status

This branch contains the expanded feature implementation. It has **not** been production-deployed. The earlier Vercel build attempts were blocked by the account's build-rate limit, so a successful production build is not yet verified. Apply migrations only after reviewing them against the live SCN schema, then run build/type-check and exercise the flows with real SCN accounts before merging or deploying.
