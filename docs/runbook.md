# Runbook

## Health
- `GET /health/live`: process is up. `GET /health/ready`: database reachable (503 otherwise). Both are used by Container Apps probes.
- Every response carries `x-request-id`; error bodies include `requestId`. Search Application Insights / Log Analytics for it.

## Deploy / rollback
1. Merge to `main`: `deploy.yml` builds images, deploys staging, runs migrations and smoke tests.
2. Approve the `production` environment gate to promote the same image tag.
3. Rollback: re-run `deploy.yml` (workflow_dispatch) with the previous image tag, or activate the previous Container Apps revision
   (`az containerapp revision activate`). Migrations are forward-only and additive; avoid destructive changes in one release.

## Migrations
`node apps/server/dist/migrate.js` (job in Container Apps, `npm run migrate -w @tausocial/server` locally). Idempotent; tracked in `schema_migrations`.

## Common incidents
| Symptom | Check |
| --- | --- |
| `/health/ready` 503 | Postgres status, firewall/VNet, `DATABASE_URL` secret in Key Vault, managed identity access |
| 401 for everyone | `JWT_SECRET` rotated (all sessions invalid by design); verify Key Vault reference |
| 429 responses | Rate limits (`RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX`); with a proxy ensure `TRUST_PROXY=1` so client IPs are correct |
| CORS errors in browser | `CORS_ORIGINS` must list the Front Door origin exactly |
| Feed unexpectedly chronological | Recommender adapter absent or failing (errors are reported through the feed route's logger) |

## Moderation operations
Moderators (`users.role = 'moderator'`) use `/api/v1/admin/*` to review reports and block, unblock or delete users and posts.
Policy rules are placeholders pending the owner (Q2).

## Secrets
Stored in Key Vault, referenced by the Container Apps via managed identity. Rotate `JWT_SECRET` by adding a new Key Vault
secret version and restarting the revision. Never commit `.env`; `npm run secrets:scan` runs in CI.
