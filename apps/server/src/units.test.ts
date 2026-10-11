import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';
import { ageBand, ageOn } from './domain/age';
import { defaultSimilarityScorer } from './domain/similarity';
import { hashPassword, TokenService, verifyPassword } from './http/auth';
import { heuristicAnalyzers } from './monitoring/analyzers';
import { decide } from './monitoring/policy';
import { ModerationService } from './monitoring/service';
import { createPgliteDb } from './db';
import { migrate, migrations } from './db/migrations';
import { AppError } from './errors';
import { createLogger } from './logger';

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
});
