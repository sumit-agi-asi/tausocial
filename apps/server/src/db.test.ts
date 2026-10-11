import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  Pool: vi.fn(),
  PGlite: vi.fn()
}));

vi.mock('pg', () => ({ Pool: mocks.Pool }));
vi.mock('@electric-sql/pglite', () => ({ PGlite: mocks.PGlite }));

import { createPgDb, createPgliteDb } from './db';

describe('PostgreSQL database adapter', () => {
  const query = vi.fn();
  const release = vi.fn();
  const connect = vi.fn();
  const end = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    query.mockResolvedValue({ rows: [{ id: '1' }], rowCount: null });
    connect.mockResolvedValue({ query, release });
    end.mockResolvedValue(undefined);
    mocks.Pool.mockImplementation(function PoolMock() {
      return { query, connect, end };
    });
  });

  it('executes queries, nested transactions, health checks, and closes the pool', async () => {
    const db = createPgDb('postgres://example', true);
    expect(mocks.Pool).toHaveBeenCalledWith(
      expect.objectContaining({ connectionString: 'postgres://example', ssl: { rejectUnauthorized: true } })
    );
    expect(await db.query('SELECT $1', ['value'])).toEqual({ rows: [{ id: '1' }], rowCount: 0 });
    await db.ping();
    const result = await db.tx(async (tx) =>
      tx.tx(async (nested) => {
        expect(await nested.query('SELECT 1')).toEqual({ rows: [{ id: '1' }], rowCount: 0 });
        await nested.ping();
        await nested.close();
        return 'complete';
      })
    );
    await db.close();
    expect(result).toBe('complete');
    expect(query.mock.calls.map(([sql]) => sql)).toEqual(['SELECT $1', 'SELECT 1', 'BEGIN', 'SELECT 1', 'SELECT 1', 'COMMIT']);
    expect(release).toHaveBeenCalledOnce();
    expect(end).toHaveBeenCalledOnce();
  });

  it('rolls back failed transactions and releases the client', async () => {
    const db = createPgDb('postgres://example', false);
    expect(mocks.Pool).toHaveBeenCalledWith(expect.objectContaining({ ssl: undefined }));
    await expect(
      db.tx(async () => {
        throw new Error('transaction failed');
      })
    ).rejects.toThrow('transaction failed');
    expect(query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'ROLLBACK']);
    expect(release).toHaveBeenCalledOnce();
  });

  it('treats PGlite results without affected-row metadata as zero affected rows', async () => {
    const runner = {
      waitReady: Promise.resolve(),
      query: vi.fn().mockResolvedValue({ rows: [] }),
      close: vi.fn().mockResolvedValue(undefined)
    };
    mocks.PGlite.mockImplementation(function PGliteMock() {
      return runner;
    });
    const db = await createPgliteDb('/test');
    expect(mocks.PGlite).toHaveBeenCalledWith('/test');
    expect(await db.query('SELECT 1')).toEqual({ rows: [], rowCount: 0 });
    await db.close();
  });
});
