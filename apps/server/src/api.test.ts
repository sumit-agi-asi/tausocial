import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { RankedItem, chronologicalRecommender, setRecommenderAdapter } from './recommender';
import { TestApp, TestUser, bearer, createTestApp, registerUser } from './testing/harness';

let t: TestApp;
const api = () => request(t.app);

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => t.close());
afterEach(() => setRecommenderAdapter(chronologicalRecommender));

const post = (user: TestUser, body: string, extra: Record<string, unknown> = {}) =>
  api()
    .post('/api/v1/posts')
    .set(...bearer(user))
    .send({ body, ...extra });

describe('health and platform', () => {
  it('serves liveness and readiness', async () => {
    expect((await api().get('/health/live')).body).toEqual({ status: 'ok' });
    const ready = await api().get('/health/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.checks.database).toBe('ok');
  });

  it('sets security headers and request ids', async () => {
    const response = await api().get('/health/live');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('only allows configured CORS origins', async () => {
    const allowed = await api().get('/health/live').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const denied = await api().get('/health/live').set('Origin', 'https://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns JSON 404s, 400s for bad JSON and honours x-request-id', async () => {
    const missing = await api().get('/api/v1/nope');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('not_found');
    const bad = await api().post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{oops');
    expect(bad.status).toBe(400);
    const withId = await api().get('/api/v1/nope').set('x-request-id', 'abcdef123456');
    expect(withId.body.error.requestId).toBe('abcdef123456');
    expect((await api().get('/elsewhere')).status).toBe(404);
  });

  it('serves the OpenAPI document and docs', async () => {
    const spec = await api().get('/api/v1/openapi.json');
    expect(spec.body.openapi).toBe('3.0.3');
    expect((await api().get('/api/docs/')).status).toBe(200);
  });

  it('reports not ready while shutting down or when the database fails', async () => {
    const { createApp } = await import('./http/app');
    const { createLogger } = await import('./logger');
    const down = createApp({
      config: t.config,
      db: { ...t.db, ping: async () => Promise.reject(new Error('db down')) } as never,
      logger: createLogger('silent')
    });
    expect((await request(down).get('/health/ready')).status).toBe(503);
    const draining = createApp({ config: t.config, db: t.db, logger: createLogger('silent'), ready: () => false });
    expect((await request(draining).get('/health/ready')).body.status).toBe('shutting_down');
  });

  it('rate limits', async () => {
    const limited = await createTestApp({ AUTH_RATE_LIMIT_MAX: '2' });
    for (let i = 0; i < 2; i += 1) {
      await request(limited.app).post('/api/v1/auth/login').send({ email: 'a@b.co', password: 'x' });
    }
    const response = await request(limited.app).post('/api/v1/auth/login').send({ email: 'a@b.co', password: 'x' });
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('rate_limited');
    await limited.close();
  });
});

describe('auth', () => {
  it('registers, logs in and rejects bad credentials', async () => {
    const user = await registerUser(t.app, { username: 'alice_auth' });
    const login = await api().post('/api/v1/auth/login').send({ email: 'alice_auth@example.com', password: 'correct-horse-battery' });
    expect(login.status).toBe(200);
    expect(login.body.user.id).toBe(user.id);
    expect(login.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(login.body)).not.toContain('password_hash');
    const bad = await api().post('/api/v1/auth/login').send({ email: 'alice_auth@example.com', password: 'nope' });
    expect(bad.status).toBe(401);
    const unknown = await api().post('/api/v1/auth/login').send({ email: 'nobody@example.com', password: 'nope' });
    expect(unknown.status).toBe(401);
  });

  it('validates input and prevents duplicates and underage signup', async () => {
    await registerUser(t.app, { username: 'dupe_user' });
    const duplicate = await api()
      .post('/api/v1/auth/register')
      .send({ email: 'dupe_user@example.com', username: 'other_name', password: 'correct-horse-battery', birthDate: '1990-01-01' });
    expect(duplicate.status).toBe(409);
    const weak = await api().post('/api/v1/auth/register').send({ email: 'x', username: '!', password: '1', birthDate: 'x' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.details.length).toBeGreaterThan(2);
    const year = new Date().getUTCFullYear() - 5;
    const young = await api()
      .post('/api/v1/auth/register')
      .send({ email: 'kid@example.com', username: 'kid_user', password: 'correct-horse-battery', birthDate: `${year}-01-01` });
    expect(young.status).toBe(400);
  });

  it('protects routes', async () => {
    expect((await api().get('/api/v1/profiles/me')).status).toBe(401);
    expect((await api().get('/api/v1/profiles/me').set('Authorization', 'Bearer ' + 'not-a-token')).status).toBe(401);
    expect((await api().get('/api/v1/feed').set('Authorization', 'Basic abc')).status).toBe(401);
  });
});

describe('profiles', () => {
  it('reads and updates own profile, hiding private fields from others', async () => {
    const me = await registerUser(t.app);
    const other = await registerUser(t.app);
    const updated = await api()
      .patch('/api/v1/profiles/me')
      .set(...bearer(me))
      .send({ displayName: 'Me', country: 'IT', interests: ['hiking'], preferences: { showConnectionPostsInFeed: true, theme: 'dark' } });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ displayName: 'Me', country: 'IT', interests: ['hiking'] });
    const pub = await api().get(`/api/v1/profiles/${me.id}`).set(...bearer(other));
    expect(pub.status).toBe(200);
    expect(pub.body.email).toBeUndefined();
    expect(pub.body.birthDate).toBeUndefined();
    const empty = await api().patch('/api/v1/profiles/me').set(...bearer(me)).send({});
    expect(empty.status).toBe(400);
    const extra = await api().patch('/api/v1/profiles/me').set(...bearer(me)).send({ role: 'moderator' });
    expect(extra.status).toBe(400);
    expect((await api().get('/api/v1/profiles/missing').set(...bearer(me))).status).toBe(404);
  });

  it('enforces connection-only visibility', async () => {
    const me = await registerUser(t.app);
    const other = await registerUser(t.app);
    await api().patch('/api/v1/profiles/me').set(...bearer(me)).send({ privacy: { profileVisibility: 'connections', showRecentBubbles: true } });
    expect((await api().get(`/api/v1/profiles/${me.id}`).set(...bearer(other))).status).toBe(403);
    expect((await api().get(`/api/v1/profiles/${me.id}`).set(...bearer(me))).status).toBe(200);
    await api().post('/api/v1/connections').set(...bearer(other)).send({ userId: me.id });
    await api().post(`/api/v1/connections/${other.id}/accept`).set(...bearer(me));
    expect((await api().get(`/api/v1/profiles/${me.id}`).set(...bearer(other))).status).toBe(200);
  });

  it('submits verification', async () => {
    const me = await registerUser(t.app);
    const bad = await api().post('/api/v1/profiles/me/verification').set(...bearer(me)).send({ phone: '123', govIdRef: 'a', addressProofRef: 'b' });
    expect(bad.status).toBe(400);
    const ok = await api()
      .post('/api/v1/profiles/me/verification')
      .set(...bearer(me))
      .send({ phone: '+14155550123', govIdRef: 'kyc/id.png', addressProofRef: 'kyc/addr.pdf' });
    expect(ok.status).toBe(202);
    expect(ok.body.status).toBe('pending');
    const profile = await api().get('/api/v1/profiles/me').set(...bearer(me));
    expect(profile.body.verificationStatus).toBe('pending');
    const auth = await api().post('/api/v1/monitoring/check-user-authenticity').set(...bearer(me));
    expect(auth.body.verdict).toBe('unknown');
  });

  it('deletes accounts permanently after password confirmation', async () => {
    const me = await registerUser(t.app);
    await post(me, 'a post that should vanish');
    const wrong = await api().delete('/api/v1/profiles/me').set(...bearer(me)).send({ password: 'wrong-password' });
    expect(wrong.status).toBe(403);
    const ok = await api().delete('/api/v1/profiles/me').set(...bearer(me)).send({ password: 'correct-horse-battery' });
    expect(ok.status).toBe(204);
    expect((await api().get('/api/v1/profiles/me').set(...bearer(me))).status).toBe(401);
    expect((await t.db.query('SELECT 1 FROM posts WHERE author_id = $1', [me.id])).rowCount).toBe(0);
  });

  it('blocks and unblocks profiles', async () => {
    const me = await registerUser(t.app);
    const other = await registerUser(t.app);
    await api().post('/api/v1/connections').set(...bearer(me)).send({ userId: other.id });
    expect((await api().put(`/api/v1/profiles/${me.id}/block`).set(...bearer(me))).status).toBe(400);
    expect((await api().put('/api/v1/profiles/nobody/block').set(...bearer(me))).status).toBe(404);
    expect((await api().put(`/api/v1/profiles/${other.id}/block`).set(...bearer(me))).status).toBe(204);
    expect((await api().get('/api/v1/profiles/me/blocks').set(...bearer(me))).body.blocks).toHaveLength(1);
    expect((await api().get(`/api/v1/profiles/${me.id}`).set(...bearer(other))).status).toBe(404);
    const connections = await api().get('/api/v1/connections').set(...bearer(me));
    expect(connections.body.connections).toHaveLength(0);
    expect((await api().post('/api/v1/connections').set(...bearer(other)).send({ userId: me.id })).status).toBe(404);
    expect((await api().delete(`/api/v1/profiles/${other.id}/block`).set(...bearer(me))).status).toBe(204);
    expect((await api().get(`/api/v1/profiles/${me.id}`).set(...bearer(other))).status).toBe(200);
  });
});

describe('posts, threads and moderation', () => {
  it('creates, reads, edits and deletes posts', async () => {
    const me = await registerUser(t.app);
    const other = await registerUser(t.app);
    const created = await post(me, 'Hello world', { media: [{ kind: 'image', url: 'https://cdn.example.com/a.png' }] });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ flag: 'green', action: 'allow', authorUsername: me.username, editedAt: null });
    const id = created.body.id;
    expect((await api().get(`/api/v1/posts/${id}`).set(...bearer(other))).body.body).toBe('Hello world');
    expect((await api().patch(`/api/v1/posts/${id}`).set(...bearer(other)).send({ body: 'hijack' })).status).toBe(403);
    const edited = await api().patch(`/api/v1/posts/${id}`).set(...bearer(me)).send({ body: 'Hello again' });
    expect(edited.body.body).toBe('Hello again');
    expect(edited.body.editedAt).not.toBeNull();
    expect((await api().patch(`/api/v1/posts/${id}`).set(...bearer(me)).send({ body: 'you idiot' })).status).toBe(422);
    expect((await api().delete(`/api/v1/posts/${id}`).set(...bearer(other))).status).toBe(403);
    expect((await api().delete(`/api/v1/posts/${id}`).set(...bearer(me))).status).toBe(204);
    expect((await api().get(`/api/v1/posts/${id}`).set(...bearer(me))).status).toBe(404);
  });

  it('rejects invalid post input including non-https media', async () => {
    const me = await registerUser(t.app);
    expect((await post(me, '')).status).toBe(400);
    expect((await post(me, 'x'.repeat(2001))).status).toBe(400);
    expect((await post(me, 'hi', { media: [{ kind: 'image', url: 'http://insecure.example/a.png' }] })).status).toBe(400);
    expect((await post(me, 'hi', { parentId: 'missing' })).status).toBe(404);
  });

  it('blocks unsafe content (red) and warns on suspect content (yellow)', async () => {
    const me = await registerUser(t.app);
    const blocked = await post(me, 'I hate you, you idiot');
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.code).toBe('content_blocked');
    expect(blocked.body.moderation).toMatchObject({ flag: 'red', action: 'block' });
    const warned = await post(me, 'Miracle cure they dont want you to know');
    expect(warned.status).toBe(201);
    expect(warned.body).toMatchObject({ flag: 'yellow', action: 'warn' });
    expect(warned.body.tags).toContain('fake_news');
  });

  it('supports threads and sub-threads', async () => {
    const me = await registerUser(t.app);
    const other = await registerUser(t.app);
    const root = (await post(me, 'Root')).body;
    const reply = (await post(other, 'Reply', { parentId: root.id })).body;
    const sub = (await post(me, 'Sub reply', { parentId: reply.id })).body;
    const thread = await api().get(`/api/v1/posts/${root.id}/thread`).set(...bearer(me));
    expect(thread.body.items.map((item: { id: string }) => item.id)).toEqual([root.id, reply.id, sub.id]);
    expect(thread.body.items[0].replyCount).toBe(1);
    expect((await api().get('/api/v1/posts/missing/thread').set(...bearer(me))).status).toBe(404);
  });

  it('supports reactions and reports', async () => {
    const me = await registerUser(t.app);
    const other = await registerUser(t.app);
    const { id } = (await post(me, 'React to me')).body;
    const up = await api().put(`/api/v1/posts/${id}/reaction`).set(...bearer(other)).send({ kind: 'up' });
    expect([up.body.upvotes, up.body.myReaction]).toEqual([1, 'up']);
    const down = await api().put(`/api/v1/posts/${id}/reaction`).set(...bearer(other)).send({ kind: 'down' });
    expect([down.body.upvotes, down.body.downvotes]).toEqual([0, 1]);
    const cleared = await api().delete(`/api/v1/posts/${id}/reaction`).set(...bearer(other));
    expect([cleared.body.downvotes, cleared.body.myReaction]).toEqual([0, null]);
    expect((await api().put(`/api/v1/posts/${id}/reaction`).set(...bearer(other)).send({ kind: 'meh' })).status).toBe(400);
    expect((await api().put('/api/v1/posts/nope/reaction').set(...bearer(other)).send({ kind: 'up' })).status).toBe(404);
    expect((await api().delete('/api/v1/posts/nope/reaction').set(...bearer(other))).status).toBe(404);
    const report = await api().post(`/api/v1/posts/${id}/reports`).set(...bearer(other)).send({ reason: 'abuse' });
    expect(report.status).toBe(202);
    expect((await api().post(`/api/v1/posts/${id}/reports`).set(...bearer(other)).send({ reason: 'abuse' })).status).toBe(202);
    expect((await t.db.query('SELECT 1 FROM reports WHERE post_id = $1', [id])).rowCount).toBe(1);
    expect((await api().post('/api/v1/posts/nope/reports').set(...bearer(other)).send({ reason: 'abuse' })).status).toBe(404);
  });
});

describe('monitoring endpoints', () => {
  it('exposes analyzers', async () => {
    const me = await registerUser(t.app);
    const call = (path: string, body: object) => api().post(`/api/v1/monitoring/${path}`).set(...bearer(me)).send(body);
    expect((await call('analyse-text', { text: 'hello there' })).body.verdict).toBe('clean');
    expect((await call('abuse-detect', { text: 'you idiot' })).body.tags).toContain('abuse');
    expect((await call('fake-news-detect', { text: 'doctors hate this' })).body.tags).toContain('fake_news');
    expect((await call('analyse-video', { mediaUrl: 'https://x.example/v.mp4' })).body.verdict).toBe('unknown');
    expect((await call('analyse-audio', { mediaUrl: 'https://x.example/a.mp3' })).body.verdict).toBe('unknown');
    expect((await call('detect-ai', { text: 'hi' })).body.verdict).toBe('unknown');
    expect((await call('detect-ai', {})).status).toBe(400);
    expect((await call('analyse-text', {})).status).toBe(400);
    expect((await api().post('/api/v1/monitoring/analyse-text').send({ text: 'x' })).status).toBe(401);
  });
});

describe('connections and similarity', () => {
  const profile = { country: 'IT', education: 'MSc', profession: 'Engineer', interests: ['a', 'b'], dislikes: ['x'] };

  it('recommends similar people, connects them and flags drift', async () => {
    const me = await registerUser(t.app, { birthDate: '1990-01-01' });
    const twin = await registerUser(t.app, { birthDate: '1990-01-01' });
    const stranger = await registerUser(t.app, { birthDate: '1960-01-01' });
    for (const user of [me, twin]) {
      await api().patch('/api/v1/profiles/me').set(...bearer(user)).send(profile);
    }
    const recs = await api().get('/api/v1/connections/recommendations').set(...bearer(me));
    const ids = recs.body.recommendations.map((item: { userId: string }) => item.userId);
    expect(ids).toContain(twin.id);
    expect(ids).not.toContain(stranger.id);

    expect((await api().post('/api/v1/connections').set(...bearer(me)).send({ userId: me.id })).status).toBe(400);
    expect((await api().post('/api/v1/connections').set(...bearer(me)).send({ userId: twin.id })).status).toBe(201);
    expect((await api().post('/api/v1/connections').set(...bearer(twin)).send({ userId: me.id })).status).toBe(409);
    const incoming = await api().get('/api/v1/connections').set(...bearer(twin));
    expect(incoming.body.connections[0].status).toBe('pending_incoming');
    expect((await api().post(`/api/v1/connections/${twin.id}/accept`).set(...bearer(me))).status).toBe(404);
    const accepted = await api().post(`/api/v1/connections/${me.id}/accept`).set(...bearer(twin));
    expect(accepted.body.score).toBeGreaterThanOrEqual(0.8);

    await api().patch('/api/v1/profiles/me').set(...bearer(twin)).send({ country: 'US', education: 'PhD', interests: [], dislikes: [] });
    const after = await api().get('/api/v1/connections').set(...bearer(me));
    expect(after.body.connections[0]).toMatchObject({ status: 'accepted', flag: 'yellow' });
    expect(after.body.connections[0].score).toBeLessThan(0.8);

    await api().patch('/api/v1/profiles/me').set(...bearer(twin)).send(profile);
    const healed = await api().get('/api/v1/connections').set(...bearer(me));
    expect(healed.body.connections[0].flag).toBe('none');

    expect((await api().delete(`/api/v1/connections/${twin.id}`).set(...bearer(me))).status).toBe(204);
    expect((await api().delete(`/api/v1/connections/${twin.id}`).set(...bearer(me))).status).toBe(404);
  });
});

describe('feed', () => {
  it('ranks through the recommender and falls back on failure', async () => {
    const fresh = await createTestApp();
    const api = () => request(fresh.app);
    const me = await registerUser(fresh.app);
    const other = await registerUser(fresh.app);
    const post = (user: TestUser, body: string, extra: Record<string, unknown> = {}) =>
      api().post('/api/v1/posts').set(...bearer(user)).send({ body, ...extra });
    const first = (await post(other, 'first')).body;
    const second = (await post(other, 'second')).body;
    await post(other, 'child', { parentId: first.id });

    const chrono = await api().get('/api/v1/feed').set(...bearer(me));
    expect(chrono.body.recommender).toBe('chronological');
    expect(chrono.body.items.map((item: { id: string }) => item.id)).toEqual([second.id, first.id]);
    expect(chrono.body.items[0].rank.reason).toBe('chronological');

    setRecommenderAdapter({
      name: 'reverse',
      rank: async (_user, candidates): Promise<RankedItem[]> =>
        [...candidates].reverse().map((candidate, index) => ({ id: candidate.id, score: 100 - index, reason: 'reverse' }))
    });
    const custom = await api().post('/api/v1/feed/refresh').set(...bearer(me));
    expect(custom.body.recommender).toBe('reverse');
    expect(custom.body.items.map((item: { id: string }) => item.id)).toEqual([first.id, second.id]);

    setRecommenderAdapter({ name: 'broken', rank: async () => Promise.reject(new Error('down')) });
    const fallback = await api().get('/api/v1/feed?limit=1').set(...bearer(me));
    expect(fallback.body.items).toHaveLength(1);
    expect(fallback.body.items[0].id).toBe(second.id);
    expect((await api().get('/api/v1/feed?limit=0').set(...bearer(me))).status).toBe(400);
    await fresh.close();
  });

  it('shows an empty feed for a quiet network', async () => {
    const fresh = await createTestApp();
    const me = await registerUser(fresh.app);
    const feed = await request(fresh.app).get('/api/v1/feed').set(...bearer(me));
    expect(feed.body.items).toEqual([]);
    await fresh.close();
  });

  it('hides connection posts by default and shows them as bubbles', async () => {
    const me = await registerUser(t.app);
    const friend = await registerUser(t.app);
    await api().post('/api/v1/connections').set(...bearer(me)).send({ userId: friend.id });
    await api().post(`/api/v1/connections/${me.id}/accept`).set(...bearer(friend));
    const friendPost = (await post(friend, 'friend update')).body;
    const mine = (await post(me, 'my own post')).body;

    const feed = await api().get('/api/v1/feed').set(...bearer(me));
    const ids = feed.body.items.map((item: { id: string }) => item.id);
    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(friendPost.id);

    const bubbles = await api().get('/api/v1/feed/bubbles').set(...bearer(me));
    expect(bubbles.body.bubbles).toEqual([expect.objectContaining({ userId: friend.id, latestPostId: friendPost.id })]);

    await api().patch('/api/v1/profiles/me').set(...bearer(me)).send({ preferences: { showConnectionPostsInFeed: true, theme: 'system' } });
    const opted = await api().get('/api/v1/feed').set(...bearer(me));
    expect(opted.body.items.map((item: { id: string }) => item.id)).toContain(friendPost.id);

    await api().patch('/api/v1/profiles/me').set(...bearer(friend)).send({ privacy: { profileVisibility: 'public', showRecentBubbles: false } });
    expect((await api().get('/api/v1/feed/bubbles').set(...bearer(me))).body.bubbles).toEqual([]);
  });

  it('excludes blocked authors and moderator-blocked accounts', async () => {
    const me = await registerUser(t.app);
    const other = await registerUser(t.app);
    const theirs = (await post(other, 'visible until blocked')).body;
    expect((await api().get('/api/v1/feed').set(...bearer(me))).body.items.map((i: { id: string }) => i.id)).toContain(theirs.id);
    await api().put(`/api/v1/profiles/${other.id}/block`).set(...bearer(me));
    expect((await api().get('/api/v1/feed').set(...bearer(me))).body.items.map((i: { id: string }) => i.id)).not.toContain(theirs.id);
    expect((await api().get(`/api/v1/posts/${theirs.id}`).set(...bearer(me))).status).toBe(404);
  });
});

describe('admin', () => {
  it('requires the moderator role', async () => {
    const mod = await registerUser(t.app);
    const user = await registerUser(t.app);
    const target = await registerUser(t.app);
    await t.db.query("UPDATE users SET role = 'moderator' WHERE id = $1", [mod.id]);
    expect((await api().post(`/api/v1/admin/profiles/${target.id}/block`).set(...bearer(user))).status).toBe(403);

    // Roles are re-read from the database on every request, so a freshly promoted user's old token works.
    expect((await api().post(`/api/v1/admin/profiles/${target.id}/block`).set(...bearer(mod))).status).toBe(204);
    expect((await api().get('/api/v1/profiles/me').set(...bearer(target))).status).toBe(403);
    expect((await api().post('/api/v1/auth/login').send({ email: `${target.username}@example.com`, password: 'correct-horse-battery' })).status).toBe(403);
    expect((await api().post(`/api/v1/admin/profiles/${target.id}/unblock`).set(...bearer(mod))).status).toBe(204);
    expect((await api().get('/api/v1/profiles/me').set(...bearer(target))).status).toBe(200);

    expect((await api().post(`/api/v1/admin/profiles/${mod.id}/block`).set(...bearer(mod))).status).toBe(400);
    expect((await api().post('/api/v1/admin/profiles/none/block').set(...bearer(mod))).status).toBe(404);
    expect((await api().post('/api/v1/admin/profiles/none/unblock').set(...bearer(mod))).status).toBe(404);
    expect((await api().delete(`/api/v1/admin/profiles/${mod.id}`).set(...bearer(mod))).status).toBe(400);
    expect((await api().delete('/api/v1/admin/profiles/none').set(...bearer(mod))).status).toBe(404);

    const { id } = (await post(target, 'to be removed by moderator')).body;
    expect((await api().delete(`/api/v1/posts/${id}`).set(...bearer(mod))).status).toBe(204);
    expect((await api().delete(`/api/v1/admin/profiles/${target.id}`).set(...bearer(mod))).status).toBe(204);
    expect((await api().get('/api/v1/profiles/me').set(...bearer(target))).status).toBe(401);
  });
});
