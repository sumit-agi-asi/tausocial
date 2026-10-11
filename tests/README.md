# Tests

- `e2e/`: Playwright (Chromium) flows plus axe WCAG A/AA scans. Starts the built API (PGlite) and `vite preview`. Run `npm run build && npm run e2e`.
- `load/smoke.mjs`: smoke checks and a light load test (p95 budget). `BASE_URL` targets a deployment; otherwise it starts the built API locally.
- `security/scan-secrets.mjs`: regex secret scanner over tracked files.

Unit, API-integration, contract and component tests live next to the code in `apps/server/src` and `apps/web/src`.
