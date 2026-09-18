import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { JsonStorage } from './storage';

let tempFile: string;
let token = '';
let appUnderTest: ReturnType<typeof createApp>;

beforeEach(async () => {
  tempFile = path.join(os.tmpdir(), `tausocial-api-${Date.now()}-${Math.random()}.json`);
  appUnderTest = createApp(new JsonStorage(tempFile));

  const login = await request(appUnderTest)
    .post('/auth/login')
    .send({ email: 'demo@tausocial.local', password: 'demo1234' });

  token = login.body.token;
});

afterEach(async () => {
  await fs.rm(tempFile, { force: true });
});

function withAuth(req: request.Test): request.Test {
  return req.set('Authorization', 'Bearer ' + token);
}

describe('TauSocial API', () => {
  it('returns health status', async () => {
    const response = await request(appUnderTest).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('authenticates seeded user', async () => {
    expect(token).toBeTruthy();
  });

  it('rejects invalid login', async () => {
    const response = await request(appUnderTest)
      .post('/auth/login')
      .send({ email: 'demo@tausocial.local', password: 'wrong-password' });
    expect(response.status).toBe(401);
  });

  it('registers new user', async () => {
    const response = await request(appUnderTest)
      .post('/auth/register')
      .send({ username: 'sam', email: 'sam@example.com', password: 'password123' });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe('sam@example.com');
  });

  it('rejects duplicate registration', async () => {
    await request(appUnderTest)
      .post('/auth/register')
      .send({ username: 'sam', email: 'sam2@example.com', password: 'password123' });

    const response = await request(appUnderTest)
      .post('/auth/register')
      .send({ username: 'sam2', email: 'sam2@example.com', password: 'password123' });

    expect(response.status).toBe(409);
  });

  it('requires auth for feed', async () => {
    const response = await request(appUnderTest).get('/feed');
    expect(response.status).toBe(401);
  });

  it('returns feed for authenticated request', async () => {
    const response = await withAuth(request(appUnderTest).get('/feed'));
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.posts)).toBe(true);
  });

  it('creates post with moderation', async () => {
    const response = await withAuth(request(appUnderTest).post('/feed/posts')).send({
      content: 'angry but accountable update'
    });

    expect(response.status).toBe(201);
    expect(response.body.post.moderation.label).toBe('watch');
  });

  it('likes a post', async () => {
    const feed = await withAuth(request(appUnderTest).get('/feed'));
    const postId = feed.body.posts[0].id;

    const response = await withAuth(request(appUnderTest).post(`/feed/posts/${postId}/like`)).send({});

    expect(response.status).toBe(200);
    expect(response.body.post.likes).toContain('u1');
  });

  it('comments on a post', async () => {
    const feed = await withAuth(request(appUnderTest).get('/feed'));
    const postId = feed.body.posts[0].id;

    const response = await withAuth(request(appUnderTest).post(`/feed/posts/${postId}/comments`)).send({
      content: 'great update'
    });

    expect(response.status).toBe(201);
    expect(response.body.comment.content).toBe('great update');
  });

  it('returns accountability metrics', async () => {
    const response = await withAuth(request(appUnderTest).get('/metrics/accountability'));

    expect(response.status).toBe(200);
    expect(response.body.metrics).toHaveProperty('authoredPosts');
  });

  it('returns feed insights', async () => {
    const response = await withAuth(request(appUnderTest).get('/insights/feed'));
    expect(response.status).toBe(200);
    expect(response.body.insights).toHaveProperty('summary');
  });
});
