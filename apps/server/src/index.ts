import { loadConfig } from './config';
import { createLogger } from './logger';
import { start } from './server';

async function main(): Promise<void> {
  const config = loadConfig();
  if (config.appInsightsConnectionString) {
    const appInsights = await import('applicationinsights');
    appInsights.setup(config.appInsightsConnectionString).start();
  }
  await start(config, createLogger(config.logLevel));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
