import { loadConfig } from './config';
import { createPgDb } from './db';
import { migrate } from './db/migrations';

async function main(): Promise<void> {
  const config = loadConfig();
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to run migrations');
  }
  const db = createPgDb(config.databaseUrl, config.databaseSsl);
  try {
    const applied = await migrate(db);
    console.log(applied.length ? `Applied migrations: ${applied.join(', ')}` : 'Database is up to date');
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
