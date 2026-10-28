# τ TauSocial

> Social media with accountability like never before, monitored by intelligence.

TauSocial is a threaded social network where every post is checked by a monitoring pipeline
(abuse, fake news, AI-generated content), tagged with a traffic-light flag (🟢 safe, 🟡 caution, 🔴 unsafe),
and where accounts are tied to verified identities. The product design comes from the sketches in
[`docs/design/`](docs/design/README.md); open questions are tracked in [`docs/QUESTIONS.md`](docs/QUESTIONS.md).

## Architecture

```
Browser ── Azure Front Door ──┬─ Static web (nginx, React + Vite)   apps/web
                              └─ /api/* ── API (Express, TypeScript) apps/server
                                              ├─ PostgreSQL (PGlite in local dev/tests)
                                              ├─ Monitoring pipeline (interfaces + heuristic stub)
                                              ├─ Recommender: recommend(userId, candidates, context)
                                              └─ Pino logs + Application Insights
Azure: Container Apps, PostgreSQL Flexible Server, Key Vault, Storage, ACR, managed identity (infrastructure/)
```

| Path | Purpose |
| --- | --- |
| `apps/web` | React 19 SPA: login/sign-up, feed, threads, profiles, connections, KYC verification, settings |
| `apps/server` | REST API `/api/v1`, zod validation, OpenAPI, migrations, monitoring, recommender |
| `infrastructure` | Azure Bicep with `PLACEHOLDER` parameters, see [`infrastructure/README.md`](infrastructure/README.md) |
| `tests` | Playwright e2e, smoke/load, secret scanning |
| `docs` | Design photos, OpenAPI spec, runbook, ADRs, recommender contract, owner questions |

Key behaviours (see the design): threads and sub-threads, thumbs up/down, post menu (edit/delete/copy/report),
tag colours, age-aware audiences, connection recommendations at similarity ≥ 0.80, yellow flag when an accepted
connection drifts apart, "recent post" bubbles for connections (connections' posts are hidden from the feed by
default), privacy/preferences, permanent account deletion, moderator block/unblock/delete.

## Setup

Requirements: Node.js ≥ 20 (22 recommended), npm ≥ 10. Docker is optional.

```bash
npm ci
cp .env.example .env      # Docker Compose reads this file; replace its placeholders
```

Direct `npm run dev:*` commands inherit exported shell variables and do not load `.env`.
The API defaults to an in-memory PGlite database and a development-only JWT secret; do not use
these defaults outside local development.
For Docker Compose, set `POSTGRES_PASSWORD`, `JWT_SECRET` (generate one with
`openssl rand -hex 32`), and `DATABASE_URL=postgres://postgres:<password>@postgres:5432/tausocial`
in `.env`.

## Run

```bash
npm run dev:server   # API on :4000, in-memory PGlite database, auto-migrated
npm run dev:web      # web on :5173, proxies /api to :4000
docker compose up --build   # Postgres + API + web on :8080 (needs POSTGRES_PASSWORD, DATABASE_URL and JWT_SECRET in .env)
```

API docs: <http://localhost:4000/api/docs> (spec: `/api/v1/openapi.json`, committed at `docs/openapi.json`).
Health: `/health/live`, `/health/ready`. Promote a moderator with SQL: `UPDATE users SET role='moderator' WHERE username='…'`.

Configuration is read from environment variables only; every variable is documented in [`.env.example`](.env.example).
Production requires `DATABASE_URL` and `JWT_SECRET`. Migrations run with `npm run migrate -w @tausocial/server`.

## Test

| Command | What |
| --- | --- |
| `npm run lint` / `npm run typecheck` | ESLint, TypeScript |
| `npm test` / `npm run test:coverage` | Unit, API integration (PGlite test DB), OpenAPI contract, React component + axe a11y tests; coverage thresholds enforced |
| `npm run openapi` | Regenerate `docs/openapi.json` (a contract test fails on drift) |
| `npm run e2e` | Playwright end-to-end + axe (run `npm run build` first; `npx playwright install chromium`) |
| `npm run smoke` | Smoke + light load test (`BASE_URL=https://… npm run smoke` to target a deployment; build first for local) |
| `npm run audit:prod` / `npm run secrets:scan` | Dependency audit, secret scanning |
| `npm run infra:validate` | `bicep build` for the template and both parameter files |

## Deploy

GitHub Actions: `ci.yml` (lint, typecheck, tests, build, audit, secrets, infra validation, OpenAPI drift, e2e, smoke),
`codeql.yml`, `docker.yml` (image builds), `deploy.yml` (OIDC login, staging, then production behind a
required-reviewer environment gate). Fill in every `<…_PLACEHOLDER>` listed in
[`infrastructure/README.md`](infrastructure/README.md) and follow its "CI/CD OIDC setup". Operations: [`docs/runbook.md`](docs/runbook.md).

## Documentation

- [Design notes](docs/design/README.md) · [Questions for the owner](docs/QUESTIONS.md)
- [Recommender contract](docs/recommender.md) · [Runbook](docs/runbook.md) · [ADRs](docs/adr/)

**&copy; Tau Social 2026. All Rights Reserved.**
