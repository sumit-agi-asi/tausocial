# TauSocial Monorepo

Production-minded TauSocial workspace with a React web app and an Express API server.

## Workspace layout

- `apps/web`: React + Vite dark social dashboard (auth, posting, likes, comments, moderation badges, accountability metrics)
- `apps/server`: Express + TypeScript API (JWT auth, validation, feed endpoints, metrics endpoints, AI moderation insights, JSON persistence)
- `.github/workflows/ci.yml`: lint, test, and build checks
- `docs/README.md`: technical notes

## Quick start

```bash
npm install
npm run dev:server
npm run dev:web
```

API defaults to `http://localhost:4000` and web consumes it via `VITE_API_URL` (defaults to the same URL).

## Quality checks

```bash
npm run lint
npm run test
npm run build
```

## API endpoints

- `POST /auth/register`
- `POST /auth/login`
- `GET /feed`
- `POST /feed/posts`
- `POST /feed/posts/:postId/like`
- `POST /feed/posts/:postId/comments`
- `GET /metrics/accountability`
- `GET /insights/feed`
- `GET /health`

## Seed/demo data

On first run, the server seeds a demo dataset in `apps/server/data/data.json`.

Demo user:
- email: `demo@tausocial.local`
- password: `demo1234`
