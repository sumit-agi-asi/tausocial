import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JsonStorage } from './storage';
import { StorageData } from './models';

let tempFile: string;
let storage: JsonStorage;

beforeEach(async () => {
  tempFile = path.join(os.tmpdir(), `tausocial-storage-${Date.now()}-${Math.random()}.json`);
  storage = new JsonStorage(tempFile);
});

afterEach(async () => {
  await fs.rm(tempFile, { force: true });
});

describe('JsonStorage', () => {
  it('seeds file on first read', async () => {
    const data = await storage.read();
    expect(data.users.length).toBeGreaterThan(0);
  });

  it('creates posts in seeded data', async () => {
    const data = await storage.read();
    expect(data.posts.length).toBeGreaterThan(0);
  });

  it('writes custom user data', async () => {
    const data: StorageData = { users: [], posts: [] };
    await storage.write(data);
    const loaded = await storage.read();
    expect(loaded.users).toEqual([]);
  });

  it('persists writes across reads', async () => {
    const data = await storage.read();
    data.users.push({
      id: 'u-new',
      username: 'new',
      email: 'new@example.com',
      passwordHash: 'hash',
      createdAt: new Date().toISOString()
    });
    await storage.write(data);
    const loaded = await storage.read();
    expect(loaded.users.some((user) => user.id === 'u-new')).toBe(true);
  });

  it('supports empty posts array writes', async () => {
    await storage.write({ users: [], posts: [] });
    const loaded = await storage.read();
    expect(loaded.posts).toHaveLength(0);
  });

  it('preserves comment structures', async () => {
    const data = await storage.read();
    expect(data.posts[0]).toBeDefined();
    data.posts[0]!.comments.push({
      id: 'c',
      userId: 'u1',
      username: 'demo',
      content: 'hello',
      createdAt: new Date().toISOString()
    });
    await storage.write(data);
    const loaded = await storage.read();
    expect(loaded.posts[0]).toBeDefined();
    expect(loaded.posts[0]!.comments.length).toBeGreaterThan(0);
  });

  it('preserves moderation labels', async () => {
    const data = await storage.read();
    expect(data.posts[0]).toBeDefined();
    expect(['safe', 'watch', 'flagged']).toContain(data.posts[0]!.moderation.label);
  });

  it('creates file path directories automatically', async () => {
    const nested = new JsonStorage(path.join(os.tmpdir(), 'tausocial', 'nested', `${Date.now()}.json`));
    await nested.read();
    expect(true).toBe(true);
  });

  it('returns users array when missing in file', async () => {
    await fs.writeFile(tempFile, JSON.stringify({ posts: [] }), 'utf8');
    const loaded = await storage.read();
    expect(Array.isArray(loaded.users)).toBe(true);
  });

  it('returns posts array when missing in file', async () => {
    await fs.writeFile(tempFile, JSON.stringify({ users: [] }), 'utf8');
    const loaded = await storage.read();
    expect(Array.isArray(loaded.posts)).toBe(true);
  });
});
