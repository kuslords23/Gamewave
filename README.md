# SCN Post

SCN Post is the social publishing and community companion in the Sport-Clan-Nexus (SCN) ecosystem.

This repository is a clean restart. The previous Gamewave implementation has been archived on the `gamewave-archive-before-scn-post` branch. No Gamewave application code is carried into this baseline.

## Product direction

Build a mobile-first, desktop-capable social publishing experience informed by focused research into Facebook, Instagram, and X. The product will unify posts, timelines, media publishing, social interactions, discovery, stories, short-form video, communities, creator tools, notifications, and privacy controls.

## Architecture principles

- Reuse SCN authentication, social data, media storage, notifications, and existing backend services.
- Keep posts and interactions interoperable with existing SCN surfaces. Do not create a duplicate social graph or publishing backend.
- Integrate the shared Royal intelligence runtime through KUS AI. Do not create a separate chatbot or model-routing stack.
- Preserve authenticated permissions and Guardian controls for actions that affect accounts or publish content.
- Audit existing SCN capabilities before rebuilding them.
- Keep implementation lean and verify each integration against the live repository and backend.

## Current status

- [x] Original Gamewave source preserved in the archive branch.
- [x] Fresh SCN Post baseline established.
- [ ] Repository and deployment configuration audit.
- [ ] Existing SCN social backend audit.
- [ ] Facebook, Instagram, and X product research.
- [ ] SCN Post product and interaction specification.
- [ ] UI implementation and integration.
