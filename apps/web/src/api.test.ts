import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, configureApi } from './api';

const respond = (status: number, body?: unknown) =>
  vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });

afterEach(() => {
  vi.unstubAllGlobals();
  configureApi({ getToken: () => null, onUnauthorized: () => undefined });
});

describe('api client', () => {
  it('sends JSON and the bearer token', async () => {
    const fetchMock = respond(200, { items: [] });
    vi.stubGlobal('fetch', fetchMock);
    configureApi({ getToken: () => 'tok', onUnauthorized: () => undefined });
    await api.createPost({ body: 'hi' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/posts');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + 'tok' });
    expect(init.body).toBe(JSON.stringify({ body: 'hi' }));
  });

  it('returns undefined for 204', async () => {
    vi.stubGlobal('fetch', respond(204));
    await expect(api.deletePost('p1')).resolves.toBeUndefined();
  });

  it('throws ApiError with code, message and moderation details', async () => {
    vi.stubGlobal('fetch', respond(422, { error: { code: 'content_blocked', message: 'nope' }, moderation: { flag: 'red', action: 'block', tags: [] } }));
    await expect(api.createPost({ body: 'x' })).rejects.toMatchObject({ status: 422, code: 'content_blocked', moderation: { flag: 'red' } });
  });

  it('signals unauthorized for authenticated calls only', async () => {
    const onUnauthorized = vi.fn();
    vi.stubGlobal('fetch', respond(401, { error: { code: 'unauthorized', message: 'Invalid or expired token' } }));
    configureApi({ getToken: () => null, onUnauthorized });
    await expect(api.me()).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).not.toHaveBeenCalled();
    configureApi({ getToken: () => 't', onUnauthorized });
    await expect(api.me()).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('wraps network failures and unreadable bodies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')));
    await expect(api.feed()).rejects.toMatchObject({ code: 'network_error', status: 0 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => Promise.reject(new Error('html')) }));
    await expect(api.feed()).rejects.toMatchObject({ status: 502, message: 'Something went wrong' });
  });

  it('builds the expected endpoints', async () => {
    const fetchMock = respond(200, {});
    vi.stubGlobal('fetch', fetchMock);
    await Promise.all([
      api.register({ email: 'a@b.co', username: 'abc', password: 'x'.repeat(10), birthDate: '1990-01-01' }),
      api.login({ email: 'a@b.co', password: 'x' }),
      api.updateMe({ bio: 'x' }),
      api.deleteMe('pw'),
      api.submitVerification({ phone: '+1', govIdRef: 'a', addressProofRef: 'b' }),
      api.profile('u1'),
      api.blockProfile('u1'),
      api.feed(5),
      api.refreshFeed(5),
      api.bubbles(),
      api.editPost('p', 'b'),
      api.thread('p'),
      api.react('p', 'up'),
      api.unreact('p'),
      api.report('p', 'abuse'),
      api.connections(),
      api.recommendations(),
      api.connect('u'),
      api.acceptConnection('u'),
      api.removeConnection('u')
    ]);
    const calls = fetchMock.mock.calls.map(([url, init]) => `${(init as RequestInit).method} ${url as string}`);
    expect(calls).toEqual(
      expect.arrayContaining([
        'POST /api/v1/auth/register',
        'PUT /api/v1/profiles/u1/block',
        'GET /api/v1/feed?limit=5',
        'POST /api/v1/feed/refresh?limit=5',
        'PUT /api/v1/posts/p/reaction',
        'DELETE /api/v1/connections/u'
      ])
    );
  });
});
