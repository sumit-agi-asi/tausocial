import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  createLogger: vi.fn(),
  start: vi.fn(),
  createPgDb: vi.fn(),
  migrate: vi.fn(),
  setup: vi.fn()
}));

vi.mock('./config', () => ({ loadConfig: mocks.loadConfig }));
vi.mock('./logger', () => ({ createLogger: mocks.createLogger }));
vi.mock('./server', () => ({ start: mocks.start }));
vi.mock('./db', () => ({ createPgDb: mocks.createPgDb }));
vi.mock('./db/migrations', () => ({ migrate: mocks.migrate }));
vi.mock('applicationinsights', () => ({ setup: mocks.setup }));

describe('executable entry points', () => {
  let exit: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.loadConfig.mockReturnValue({
      appInsightsConnectionString: undefined,
      logLevel: 'silent',
      databaseUrl: 'postgres://db',
      databaseSsl: false
    });
    mocks.createLogger.mockReturnValue({});
    mocks.start.mockResolvedValue(undefined);
    mocks.migrate.mockResolvedValue([]);
    mocks.createPgDb.mockReturnValue({ close: vi.fn().mockResolvedValue(undefined) });
  });

  afterEach(() => {
    exit.mockRestore();
    error.mockRestore();
  });

  it('starts the API without Application Insights', async () => {
    await import('./index');
    await vi.waitFor(() => expect(mocks.start).toHaveBeenCalledOnce());
    expect(mocks.createLogger).toHaveBeenCalledWith('silent');
    expect(mocks.setup).not.toHaveBeenCalled();
  });

  it('initializes Application Insights when configured', async () => {
    mocks.loadConfig.mockReturnValue({
      appInsightsConnectionString: 'InstrumentationKey=test',
      logLevel: 'info'
    });
    mocks.setup.mockReturnValue({ start: vi.fn() });
    await import('./index');
    await vi.waitFor(() => expect(mocks.start).toHaveBeenCalledOnce());
    expect(mocks.setup).toHaveBeenCalledWith('InstrumentationKey=test');
  });

  it('logs API startup failures and exits unsuccessfully', async () => {
    const failure = new Error('startup failed');
    mocks.start.mockRejectedValue(failure);
    await import('./index');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
    expect(error).toHaveBeenCalledWith(failure);
  });

  it('runs migrations and closes the database when changes are applied', async () => {
    const db = { close: vi.fn().mockResolvedValue(undefined) };
    mocks.createPgDb.mockReturnValue(db);
    mocks.migrate.mockResolvedValue(['001']);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await import('./migrate');
    await vi.waitFor(() => expect(db.close).toHaveBeenCalledOnce());
    expect(log).toHaveBeenCalledWith('Applied migrations: 001');
    log.mockRestore();
  });

  it('reports an up-to-date database and rejects migration without a URL', async () => {
    const db = { close: vi.fn().mockResolvedValue(undefined) };
    mocks.createPgDb.mockReturnValue(db);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await import('./migrate');
    await vi.waitFor(() => expect(console.log).toHaveBeenCalledWith('Database is up to date'));
    log.mockRestore();

    vi.resetModules();
    vi.clearAllMocks();
    mocks.loadConfig.mockReturnValue({ databaseUrl: undefined });
    await import('./migrate');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: 'DATABASE_URL is required to run migrations' }));
    expect(mocks.createPgDb).not.toHaveBeenCalled();
  });

  it('closes the database and exits when a migration fails', async () => {
    const db = { close: vi.fn().mockResolvedValue(undefined) };
    const failure = new Error('migration failed');
    mocks.createPgDb.mockReturnValue(db);
    mocks.migrate.mockRejectedValue(failure);
    await import('./migrate');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
    expect(db.close).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith(failure);
  });
});
