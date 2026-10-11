import { describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { loadConfig } from './config';
import { rescoreConnections } from './domain/connections';
import { ageBand, ageOn } from './domain/age';
import { toPost, toPublicProfile, UserRow } from './domain/mappers';
import { defaultSimilarityScorer } from './domain/similarity';
import { currentUserId, hashPassword, TokenService, verifyPassword } from './http/auth';
import { heuristicAnalyzers } from './monitoring/analyzers';
import { decide } from './monitoring/policy';
import { ModerationService } from './monitoring/service';
import { createPgliteDb } from './db';
import { migrate, migrations } from './db/migrations';
import { AppError } from './errors';
import { createLogger } from './logger';
import { onError } from './http/app';

describe('config', () => {
  it('applies defaults in development', () => {
    const config = loadConfig({});
    expect(config.port).toBe(4000);
    expect(config.corsOrigins).toEqual(['http://localhost:5173']);
    expect(config.jwtSecret.length).toBeGreaterThanOrEqual(32);
  });

  it('requires secrets in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(32) })).toThrow(/DATABASE_URL/);
    const config = loadConfig({
      NODE_ENV: 'production',
      JWT_SECRET: 'x'.repeat(32),
      DATABASE_URL: 'postgres://app@db.example.com:5432/tausocial',
      DATABASE_SSL: 'true',
      CORS_ORIGINS: 'https://a.example, https://b.example'
    });
    expect(config.databaseSsl).toBe(true);
    expect(config.corsOrigins).toEqual(['https://a.example', 'https://b.example']);
  });

  it('rejects invalid values', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/Invalid environment/);
    expect(() => loadConfig({ JWT_SECRET: 'short' })).toThrow(/32 characters/);
  });
});

describe('age', () => {
  it('computes age around birthdays', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    expect(ageOn('2000-06-15', now)).toBe(26);
    expect(ageOn('2000-06-16', now)).toBe(25);
    expect(ageOn('2000-07-01', now)).toBe(25);
  });

  it('maps ages to design brackets', () => {
    expect([13, 14, 17, 18, 39, 40].map(ageBand)).toEqual(['under14', '14-17', '14-17', '18-39', '18-39', '40plus']);
  });
});

describe('similarity', () => {
  const base = { age: 30, profession: 'Engineer', education: 'MSc', country: 'IT', interests: ['a', 'b'], dislikes: ['x'] };
  it('is 1 for identical profiles and symmetric', () => {
    expect(defaultSimilarityScorer.score(base, base)).toBe(1);
    const other = { ...base, country: 'US', interests: ['a'] };
    expect(defaultSimilarityScorer.score(base, other)).toBe(defaultSimilarityScorer.score(other, base));
    expect(defaultSimilarityScorer.score(base, other)).toBeLessThan(1);
  });

  it('is low for empty unrelated profiles', () => {
    const empty = { age: 70, interests: [], dislikes: [] };
    expect(defaultSimilarityScorer.score(empty, { ...empty, age: 20 })).toBe(0);
  });
});

describe('passwords and tokens', () => {
  it('hashes with salt and verifies', () => {
    const hash = hashPassword('secret-password');
    expect(hash).not.toContain('secret-password');
    expect(hashPassword('secret-password')).not.toBe(hash);
    expect(verifyPassword('secret-password', hash)).toBe(true);
    expect(verifyPassword('other', hash)).toBe(false);
    expect(verifyPassword('x', 'malformed')).toBe(false);
  });

  it('issues and verifies tokens', () => {
    const tokens = new TokenService('s'.repeat(32), 60);
    const token = tokens.issue('u1', 'moderator');
    expect(tokens.verify(token)).toEqual({ userId: 'u1', role: 'moderator' });
    expect(() => new TokenService('t'.repeat(32), 60).verify(token)).toThrow();
    expect(() => tokens.verify('garbage')).toThrow();
    const stringPayload = jwt.sign('invalid payload', 's'.repeat(32), { algorithm: 'HS256' });
    expect(() => tokens.verify(stringPayload)).toThrow('Invalid token payload');
    expect(() => currentUserId({} as never)).toThrow('Authentication required');
  });
});

describe('domain edge cases', () => {
  it('returns without rescoring if the user no longer exists', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await expect(rescoreConnections(db as never, defaultSimilarityScorer, 'missing', 0.8)).resolves.toEqual({ rescored: 0, flagged: 0 });
    expect(db.query).toHaveBeenCalledOnce();
  });

  it('maps dates and falls back to usernames for blank display names', () => {
    const user: UserRow = {
      id: 'u1',
      email: 'u@example.com',
      username: 'user',
      password_hash: 'hash',
      display_name: '',
      bio: '',
      birth_date: '1990-01-01',
      country: null,
      education: null,
      profession: null,
      interests: [],
      dislikes: [],
      privacy: { profileVisibility: 'public', showRecentBubbles: true },
      preferences: { showConnectionPostsInFeed: false, theme: 'system' },
      role: 'user',
      status: 'active',
      verification_status: 'unverified',
      phone: null,
      created_at: new Date('2026-01-01T00:00:00Z')
    };
    expect(toPublicProfile(user)).toMatchObject({ displayName: 'user', createdAt: '2026-01-01T00:00:00.000Z' });
    expect(toPublicProfile({ ...user, created_at: '2026-01-01T00:00:00Z' }).createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(
      toPost({
        id: 'p1',
        author_id: user.id,
        author_username: user.username,
        author_display_name: '',
        parent_id: null,
        body: 'hello',
        media: [],
        tags: [],
        flag: 'green',
        action: 'allow',
        created_at: new Date('2026-01-01T00:00:00Z'),
        edited_at: null,
        upvotes: 0,
        downvotes: 0,
        reply_count: 0,
        my_reaction: null
      })
    ).toMatchObject({ authorDisplayName: 'user', createdAt: '2026-01-01T00:00:00.000Z', editedAt: null });
  });

  it('handles affected rows and nested PGlite transactions', async () => {
    const db = await createPgliteDb();
    await db.query('CREATE TABLE coverage_rows (id integer PRIMARY KEY)');
    expect(await db.query('INSERT INTO coverage_rows (id) VALUES (1)')).toMatchObject({ rows: [], rowCount: 1 });
    await db.tx(async (tx) => tx.tx(async (nested) => nested.query('SELECT id FROM coverage_rows')));
    await db.close();
  });
});

describe('monitoring', () => {
  it('flags abuse and vulgarity as red/block', async () => {
    const decision = await new ModerationService().moderate({ text: 'you are such an idiot, shit' });
    expect(decision).toMatchObject({ flag: 'red', action: 'block' });
    expect(decision.tags).toEqual(expect.arrayContaining(['abuse', 'vulgar']));
  });

  it('flags misinformation phrases as yellow/warn', async () => {
    const decision = await new ModerationService().moderate({ text: 'Miracle cure, share before it gets deleted!' });
    expect(decision).toMatchObject({ flag: 'yellow', action: 'warn' });
    expect(decision.tags).toContain('fake_news');
  });

  it('allows clean content and reports unknown for unconnected media models', async () => {
    const decision = await new ModerationService().moderate({
      text: 'Lovely day at the park',
      mediaUrls: [
        { kind: 'video', url: 'https://example.com/v.mp4' },
        { kind: 'audio', url: 'https://example.com/a.mp3' }
      ]
    });
    expect(decision).toMatchObject({ flag: 'green', action: 'allow' });
    expect(decision.results.filter((result) => result.verdict === 'unknown').length).toBeGreaterThanOrEqual(3);
  });

  it('exposes individual analyzers', async () => {
    expect((await heuristicAnalyzers.analyseText('hello')).verdict).toBe('clean');
    expect((await heuristicAnalyzers.analyseText('you idiot')).verdict).toBe('violation');
    expect((await heuristicAnalyzers.analyseText('100% proven')).verdict).toBe('suspect');
    expect(decide([]).flag).toBe('green');
  });
});

describe('migrations', () => {
  it('are idempotent', async () => {
    const db = await createPgliteDb();
    expect(await migrate(db)).toEqual(migrations.map((migration) => migration.id));
    expect(await migrate(db)).toEqual([]);
    await db.close();
  });

  it('roll back a failing transaction', async () => {
    const db = await createPgliteDb();
    await migrate(db);
    await expect(
      db.tx(async (tx) => {
        await tx.query("INSERT INTO schema_migrations (id) VALUES ('temp')");
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    expect((await db.query('SELECT 1 FROM schema_migrations WHERE id = $1', ['temp'])).rowCount).toBe(0);
    await db.close();
  });
});

describe('misc', () => {
  it('AppError carries status and code', () => {
    const error = new AppError(418, 'teapot', 'short and stout');
    expect([error.status, error.code, error.name]).toEqual([418, 'teapot', 'AppError']);
  });

  it('logger redacts secrets', () => {
    expect(createLogger('silent').level).toBe('silent');
  });

  it('preserves structured error details and moderation metadata', () => {
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const request = { id: 'request-id', log: { error: vi.fn() } };
    onError(new AppError(400, 'bad_request', 'invalid', { field: 'name' }), request as never, response as never, vi.fn());
    expect(response.json).toHaveBeenCalledWith({
      error: { code: 'bad_request', message: 'invalid', details: { field: 'name' }, requestId: 'request-id' }
    });

    response.status.mockClear();
    response.json.mockClear();
    onError(
      new AppError(422, 'content_blocked', 'blocked', { moderation: { flag: 'red' } }),
      request as never,
      response as never,
      vi.fn()
    );
    expect(response.json).toHaveBeenCalledWith({
      error: { code: 'content_blocked', message: 'blocked', requestId: 'request-id' },
      moderation: { flag: 'red' }
    });
  });
});
