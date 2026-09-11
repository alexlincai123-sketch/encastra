import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // apps/* was missing, so a test placed in the desktop app would never have run.
    include: [
      'packages/*/test/**/*.test.ts',
      'apps/*/test/**/*.test.ts',
      'services/*/test/**/*.test.ts',
      // Invariants that belong to the repository rather than to any one package — the version
      // agreeing with itself across six files, for instance.
      'tests/**/*.test.ts',
    ],
    environment: 'node',
    // A hanging test is a failing test; it should not hold CI open.
    testTimeout: 10_000,
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
      reporter: ['text-summary', 'lcov'],
    },
  },
});
