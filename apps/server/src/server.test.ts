import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createPgDb: vi.fn(),
  createPgliteDb: vi.fn(),
  migrate: vi.fn(),
  createApp: vi.fn()
}));

vi.mock('./db', () => ({ createPgDb: mocks.createPgDb, createPgliteDb: mocks.createPgliteDb }));
vi.mock('./db/migrations', () => ({ migrate: mocks.migrate }));
vi.mock('./http/app', () => ({ createApp: mocks.createApp }));

import { loadConfig } from './config';
import { createDb, start } from './server';

describe('server startup and shutdown', () => {
  const db = { close: vi.fn(), ping: vi.fn(), query: vi.fn(), tx: vi.fn() };
  const logger = { info: vi.fn(), error: vi.fn() };
  const serverClose = vi.fn();
  const listen = vi.fn();
  let exit: ReturnType<typeof vi.spyOn>;
  let timeout: ReturnType<typeof vi.spyOn>;
  let timeoutCallback: (() => void) | undefined;
  let registeredHandlers: Array<[NodeJS.Signals, (...args: unknown[]) => void]>;

  beforeEach(() => {
    vi.clearAllMocks();
    timeoutCallback = undefined;
    registeredHandlers = [];
    db.close.mockResolvedValue(undefined);
    mocks.createPgDb.mockReturnValue(db);
    mocks.createPgliteDb.mockResolvedValue(db);
    mocks.migrate.mockResolvedValue([]);
    listen.mockImplementation((_port, callback) => {
      callback();
      return { close: serverClose };
    });
    serverClose.mockImplementation((callback) => callback());
    mocks.createApp.mockReturnValue({ listen });
    exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(process, 'on').mockImplementation((event, listener) => {
      if (event === 'SIGTERM' || event === 'SIGINT') {
        registeredHandlers.push([event, listener as (...args: unknown[]) => void]);
      }
      return process;
    });
    timeout = vi.spyOn(global, 'setTimeout').mockImplementation((callback) => {
      timeoutCallback = callback as () => void;
      return { unref: vi.fn() } as unknown as ReturnType<typeof setTimeout>;
    });
  });

  afterEach(() => {
    for (const [signal, handler] of registeredHandlers) process.removeListener(signal, handler);
    exit.mockRestore();
    timeout.mockRestore();
    vi.restoreAllMocks();
  });

  it('creates PostgreSQL or PGlite according to configuration', async () => {
    const base = loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test-secret-test-secret-test-secret-123456' });
    await createDb({ ...base, databaseUrl: 'postgres://db', databaseSsl: true });
    expect(mocks.createPgDb).toHaveBeenCalledWith('postgres://db', true);

    await createDb({ ...base, databaseUrl: undefined, pgliteDataDir: '/tmp/tausocial-test' });
    expect(mocks.createPgliteDb).toHaveBeenCalledWith('/tmp/tausocial-test');
  });

  it('migrates local databases and shuts down once on a signal', async () => {
    const config = loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test-secret-test-secret-test-secret-123456' });
    await start(config, logger as never);

    expect(mocks.migrate).toHaveBeenCalledWith(db);
    const dependencies = mocks.createApp.mock.calls[0]?.[0];
    expect(dependencies.ready()).toBe(true);
    expect(logger.info).toHaveBeenCalledWith({ port: 4000 }, 'TauSocial API listening');

    const sigterm = registeredHandlers.find(([signal]) => signal === 'SIGTERM')?.[1];
    expect(sigterm).toBeDefined();
    sigterm?.('SIGTERM');
    sigterm?.('SIGTERM');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(dependencies.ready()).toBe(false);
    expect(serverClose).toHaveBeenCalledOnce();
    expect(db.close).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(0);
    expect(timeout).toHaveBeenCalledWith(expect.any(Function), 10_000);
  });

  it('skips production migrations and logs close failures before the shutdown deadline', async () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      JWT_SECRET: 'test-secret-test-secret-test-secret-123456',
      DATABASE_URL: 'postgres://db'
    });
    db.close.mockRejectedValue(new Error('close failed'));
    serverClose.mockImplementation((callback) => callback());
    await start(config, logger as never);
    expect(mocks.migrate).not.toHaveBeenCalled();

    const sigint = registeredHandlers.find(([signal]) => signal === 'SIGINT')?.[1];
    sigint?.('SIGINT');
    await vi.waitFor(() => expect(logger.error).toHaveBeenCalled());
    expect(logger.error).toHaveBeenCalledWith({ err: expect.any(Error) }, 'error closing database');
    timeoutCallback?.();
    expect(exit).toHaveBeenCalledWith(1);
  });
});
