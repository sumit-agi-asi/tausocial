# TauSocial API Server

Express + TypeScript API with JWT authentication, Zod input validation, threaded posts,
profiles, connections, feeds, moderation, and OpenAPI documentation.

## Local development

From the repository root, install dependencies with `npm ci` and run:

```bash
npm run dev:server
```

The API listens on port 4000 by default and uses an auto-migrated, in-memory PGlite
database unless `DATABASE_URL` points to PostgreSQL. See the root
[`.env.example`](../../.env.example) for supported environment variables.

For production, configure `DATABASE_URL` and a `JWT_SECRET` of at least 32 characters.
Run database migrations with `npm run migrate --workspace @tausocial/server` before
starting the API.
