import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'services/*/test/**/*.test.ts'],
    environment: 'node',
    // A hanging test is a failing test; it should not hold CI open.
    testTimeout: 10_000,
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      reporter: ['text-summary', 'lcov'],
    },
  },
});
