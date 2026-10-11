#!/usr/bin/env node
// Smoke + light load test. Targets BASE_URL (e.g. staging); when unset, starts the built API
// locally (needs `npm run build`) on an in-memory database.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const CONCURRENCY = Number(process.env.SMOKE_CONCURRENCY ?? 10);
const REQUESTS = Number(process.env.SMOKE_REQUESTS ?? 200);
const P95_BUDGET_MS = Number(process.env.SMOKE_P95_MS ?? 500);

let base = process.env.BASE_URL;
let child;

async function waitReady(url) {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`${url}/health/ready`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }
  throw new Error('API did not become ready');
}

async function main() {
  if (!base) {
    const port = 4100 + Math.floor(Math.random() * 500);
    base = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, ['apps/server/dist/index.js'], {
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PORT: String(port),
        LOG_LEVEL: 'warn',
        JWT_SECRET: randomBytes(32).toString('hex'),
        RATE_LIMIT_MAX: '100000',
        AUTH_RATE_LIMIT_MAX: '100000'
      },
      stdio: 'inherit'
    });
  }
  await waitReady(base);

  const failures = [];
  const check = (name, ok) => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
    if (!ok) failures.push(name);
  };

  const live = await fetch(`${base}/health/live`);
  check('GET /health/live is 200', live.status === 200);
  const spec = await fetch(`${base}/api/v1/openapi.json`);
  check('GET /api/v1/openapi.json is 200', spec.status === 200);
  check('security headers present', live.headers.get('x-content-type-options') === 'nosniff');
  const anon = await fetch(`${base}/api/v1/feed`);
  check('feed requires authentication', anon.status === 401);

  if (process.env.SMOKE_READ_ONLY !== '1') {
    const suffix = randomBytes(4).toString('hex');
    const reg = await fetch(`${base}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `smoke-${suffix}@example.com`,
        username: `smoke${suffix}`,
        password: randomBytes(12).toString('hex'),
        birthDate: '1990-01-01'
      })
    });
    check('register returns 201', reg.status === 201);
    const { token } = await reg.json();
    const auth = { Authorization: 'Bearer ' + token };
    const post = await fetch(`${base}/api/v1/posts`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'Smoke test post' })
    });
    check('create post returns 201', post.status === 201);
    const feed = await fetch(`${base}/api/v1/feed`, { headers: auth });
    check('feed returns 200', feed.status === 200);

    const latencies = [];
    let errors = 0;
    let next = 0;
    const worker = async () => {
      while (next < REQUESTS) {
        next += 1;
        const start = performance.now();
        try {
          const res = await fetch(`${base}/api/v1/feed`, { headers: auth });
          if (!res.ok) errors += 1;
          await res.arrayBuffer();
        } catch {
          errors += 1;
        }
        latencies.push(performance.now() - start);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95) - 1] ?? 0;
    console.log(`load: ${latencies.length} requests, ${errors} errors, p95=${p95.toFixed(1)}ms`);
    check('load: no errors', errors === 0);
    check(`load: p95 under ${P95_BUDGET_MS}ms`, p95 < P95_BUDGET_MS);
  }

  if (failures.length > 0) throw new Error(`Smoke failed: ${failures.join(', ')}`);
  console.log('Smoke test passed');
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => child?.kill());
