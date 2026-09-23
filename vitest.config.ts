import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // apps/* was missing, so a test placed in the desktop app would never have run. `.tsx` was
    // missing for the same reason, and more quietly: a test that renders a component has to be a
    // `.tsx` file, and one written here would have been collected by nothing, run by nothing, and
    // reported as nothing — a green suite that never opened the file.
    include: [
      'packages/*/test/**/*.test.{ts,tsx}',
      'apps/*/test/**/*.test.{ts,tsx}',
      'services/*/test/**/*.test.{ts,tsx}',
      // Invariants that belong to the repository rather than to any one package — the version
      // agreeing with itself across six files, for instance.
      'tests/**/*.test.{ts,tsx}',
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
