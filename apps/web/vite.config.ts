import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': process.env.VITE_DEV_API_TARGET ?? 'http://localhost:4000' }
  },
  preview: { port: 4173, proxy: { '/api': process.env.VITE_DEV_API_TARGET ?? 'http://localhost:4000' } },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/setupTests.ts', 'src/vite-env.d.ts'],
      reporter: ['text-summary', 'lcov'],
      thresholds: { lines: 100, functions: 100, statements: 100, branches: 100 }
    }
  }
});
