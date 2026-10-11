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
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/setupTests.ts', 'src/testing/**', 'src/vite-env.d.ts'],
      reporter: ['text-summary', 'lcov'],
      thresholds: { lines: 97, functions: 92, statements: 95, branches: 84 }
    }
  }
});
