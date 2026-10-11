import { readFileSync } from 'node:fs';
import path from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from './http/openapi';
import { TestApp, bearer, createTestApp, registerUser } from './testing/harness';

const document = buildOpenApiDocument();
let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => t.close());

function validator(schemaName: string) {
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);
  return ajv.compile({ $ref: `#/components/schemas/${schemaName}`, components: document.components });
}

function expectValid(schemaName: string, body: unknown) {
  const validate = validator(schemaName);
  const ok = validate(body);
  expect(ok, JSON.stringify(validate.errors)).toBe(true);
}

describe('OpenAPI contract', () => {
  it('is a valid OpenAPI 3 document', async () => {
    const copy = JSON.parse(JSON.stringify(document));
    const api = await SwaggerParser.validate(copy);
    expect(api.info.title).toBe('TauSocial API');
  });

  it('matches the committed docs/openapi.json (run `npm run openapi` to refresh)', () => {
    const committed = JSON.parse(readFileSync(path.resolve(__dirname, '../../../docs/openapi.json'), 'utf8'));
    expect(committed).toEqual(JSON.parse(JSON.stringify(document)));
  });

  it('documents every router mounted by the app', () => {
    const paths = Object.keys(document.paths);
    for (const expected of [
      '/auth/register',
      '/auth/login',
      '/profiles/me',
      '/posts',
      '/posts/{id}/thread',
      '/feed',
      '/feed/bubbles',
      '/connections/recommendations',
      '/monitoring/analyse-text',
      '/monitoring/check-user-authenticity',
      '/admin/profiles/{id}/block'
    ]) {
      expect(paths).toContain(expected);
    }
  });

  it('secures every operation except register and login', () => {
    for (const [path, item] of Object.entries(document.paths)) {
      for (const operation of Object.values(item as Record<string, { security?: unknown }>)) {
        const open = path === '/auth/register' || path === '/auth/login';
        expect(Boolean(operation.security), path).toBe(!open);
      }
    }
  });

  it('live responses conform to the documented schemas', async () => {
    const app = request(t.app);
    const me = await registerUser(t.app);
    const friend = await registerUser(t.app);

    const registered = await app
      .post('/api/v1/auth/register')
      .send({ email: 'contract@example.com', username: 'contract_user', password: 'correct-horse-battery', birthDate: '1991-02-03' });
    expectValid('AuthResponse', registered.body);

    expectValid('MyProfile', (await app.get('/api/v1/profiles/me').set(...bearer(me))).body);
    expectValid('PublicProfile', (await app.get(`/api/v1/profiles/${friend.id}`).set(...bearer(me))).body);

    const created = await app.post('/api/v1/posts').set(...bearer(me)).send({ body: 'contract post' });
    expectValid('Post', created.body);
    expectValid('FeedResponse', (await app.get('/api/v1/feed').set(...bearer(friend))).body);
    expectValid('BubbleResponse', (await app.get('/api/v1/feed/bubbles').set(...bearer(me))).body);

    await app.post('/api/v1/connections').set(...bearer(me)).send({ userId: friend.id });
    const connections = await app.get('/api/v1/connections').set(...bearer(me));
    expect(connections.body.connections).toHaveLength(1);
    expectValid('Connection', connections.body.connections[0]);

    const analysis = await app.post('/api/v1/monitoring/analyse-text').set(...bearer(me)).send({ text: 'you idiot' });
    expectValid('AnalysisResult', analysis.body);

    const verification = await app
      .post('/api/v1/profiles/me/verification')
      .set(...bearer(me))
      .send({ phone: '+14155550123', govIdRef: 'a', addressProofRef: 'b' });
    expectValid('Verification', verification.body);

    const blocked = await app.post('/api/v1/posts').set(...bearer(me)).send({ body: 'you idiot' });
    expect(blocked.status).toBe(422);
    expectValid('ErrorResponse', blocked.body);
    expectValid('ErrorResponse', (await app.get('/api/v1/profiles/me')).body);
    expectValid('ErrorResponse', (await app.post('/api/v1/auth/login').send({})).body);
  });
});
