import request from 'supertest';
import { Config, loadConfig } from '../config';
import { Db, createPgliteDb } from '../db';
import { migrate } from '../db/migrations';
import { createApp } from '../http/app';
import { createLogger } from '../logger';

export interface TestApp {
  app: ReturnType<typeof createApp>;
  db: Db;
  config: Config;
  close(): Promise<void>;
}

export async function createTestApp(overrides: Record<string, string> = {}): Promise<TestApp> {
  const config = loadConfig({
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-test-secret-test-secret-123456',
    RATE_LIMIT_MAX: '100000',
    AUTH_RATE_LIMIT_MAX: '100000',
    CORS_ORIGINS: 'http://localhost:5173',
    ...overrides
  });
  const db = await createPgliteDb();
  await migrate(db);
  const app = createApp({ config, db, logger: createLogger('silent') });
  return { app, db, config, close: () => db.close() };
}

export interface TestUser {
  id: string;
  token: string;
  username: string;
}

let counter = 0;

export async function registerUser(
  app: TestApp['app'],
  overrides: Partial<{ username: string; birthDate: string }> = {}
): Promise<TestUser> {
  counter += 1;
  const username = overrides.username ?? `user_${counter}_${crypto.randomUUID().slice(0, 4)}`;
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({
      email: `${username}@example.com`,
      username,
      password: 'correct-horse-battery',
      birthDate: overrides.birthDate ?? '1990-05-20'
    });
  if (response.status !== 201) {
    throw new Error(`register failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return { id: response.body.user.id, token: response.body.token, username };
}

export const bearer = (user: TestUser): [string, string] => ['Authorization', 'Bearer ' + user.token];
