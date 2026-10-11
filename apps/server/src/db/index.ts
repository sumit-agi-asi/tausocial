import { PGlite } from '@electric-sql/pglite';
import { Pool, PoolClient } from 'pg';

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

/** Minimal database port implemented by node-postgres (production) and PGlite (dev/test). */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

class PgDb implements Db {
  constructor(
    private readonly runner: Pool | PoolClient,
    private readonly pool?: Pool
  ) {}

  async query<T>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const result = await this.runner.query(sql, params);
    return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
  }

  async tx<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    if (!this.pool) {
      return fn(this);
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(new PgDb(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async ping(): Promise<void> {
    await this.runner.query('SELECT 1');
  }

  async close(): Promise<void> {
    await this.pool?.end();
  }
}

type PgliteRunner = Pick<PGlite, 'query'>;

class PgliteDb implements Db {
  constructor(
    private readonly runner: PgliteRunner,
    private readonly root?: PGlite
  ) {}

  async query<T>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const result = await this.runner.query<T>(sql, params);
    return { rows: result.rows, rowCount: Math.max(result.rows.length, result.affectedRows ?? 0) };
  }

  async tx<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    if (!this.root) {
      return fn(this);
    }
    return this.root.transaction((transaction) => fn(new PgliteDb(transaction)));
  }

  async ping(): Promise<void> {
    await this.runner.query('SELECT 1');
  }

  async close(): Promise<void> {
    await this.root?.close();
  }
}

export function createPgDb(connectionString: string, ssl: boolean): Db {
  const pool = new Pool({
    connectionString,
    ssl: ssl ? { rejectUnauthorized: true } : undefined,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000
  });
  return new PgDb(pool, pool);
}

/** In-process Postgres (WASM). Used by tests and for zero-dependency local development. */
export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const instance = new PGlite(dataDir);
  await instance.waitReady;
  return new PgliteDb(instance, instance);
}
