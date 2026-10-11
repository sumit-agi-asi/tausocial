import { defineConfig, devices } from '@playwright/test';

const API_PORT = 4300;
const WEB_PORT = 4301;

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { outputFolder: '../../playwright-report', open: 'never' }]] : 'list',
  outputDir: '../../test-results',
  use: { baseURL: `http://127.0.0.1:${WEB_PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node apps/server/dist/index.js',
      cwd: '../..',
      url: `http://127.0.0.1:${API_PORT}/health/ready`,
      reuseExistingServer: !process.env['CI'],
      env: {
        NODE_ENV: 'development',
        PORT: String(API_PORT),
        LOG_LEVEL: 'warn',
        JWT_SECRET: 'e2e-only-secret-e2e-only-secret-0123456789',
        RATE_LIMIT_MAX: '100000',
        AUTH_RATE_LIMIT_MAX: '100000'
      }
    },
    {
      command: `npm run preview -w @tausocial/web -- --port ${WEB_PORT} --host 127.0.0.1 --strictPort`,
      cwd: '../..',
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: !process.env['CI'],
      env: { VITE_DEV_API_TARGET: `http://127.0.0.1:${API_PORT}` }
    }
  ]
});
