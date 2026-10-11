import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/testing/**', 'src/index.ts', 'src/migrate.ts', 'src/server.ts'],
      reporter: ['text-summary', 'lcov'],
      thresholds: { lines: 95, functions: 95, statements: 94, branches: 86 }
    }
  }
});
