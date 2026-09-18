# TauSocial Technical Notes

## Runtime surfaces
- `apps/server`: Express + TypeScript API with JWT auth, feed interactions, moderation insights, and JSON persistence.
- `apps/web`: React + Vite dark dashboard with authentication flow and feed interactions.

## Data and moderation model
- Server stores state in `apps/server/data/data.json` and seeds demo users/posts on first load.
- AI moderation marks content as `safe`, `watch`, or `flagged` and exposes moderation highlights and insight summaries.

## Local development
1. `npm install`
2. `npm run dev:server`
3. `npm run dev:web`

## Quality gates
- Lint: `npm run lint`
- Test: `npm run test`
- Build: `npm run build`
