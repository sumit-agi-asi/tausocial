import { Config } from './config';
import { createPgDb, createPgliteDb, Db } from './db';
import { migrate } from './db/migrations';
import { createApp } from './http/app';
import { Logger } from './logger';

export async function createDb(config: Config): Promise<Db> {
  return config.databaseUrl ? createPgDb(config.databaseUrl, config.databaseSsl) : createPgliteDb(config.pgliteDataDir);
}

export async function start(config: Config, logger: Logger): Promise<void> {
  const db = await createDb(config);
  // Production schema changes are applied by the migrate job (`npm run migrate`); dev/PGlite self-migrates.
  if (!config.databaseUrl) {
    await migrate(db);
  }

  let shuttingDown = false;
  const app = createApp({ config, db, logger, ready: () => !shuttingDown });
  const server = app.listen(config.port, () => logger.info({ port: config.port }, 'TauSocial API listening'));

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');
    server.close(() => {
      db.close()
        .catch((error) => logger.error({ err: error }, 'error closing database'))
        .finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
