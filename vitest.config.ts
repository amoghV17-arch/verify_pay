import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    testTimeout: 60000,
    hookTimeout: 60000,
    include: [
      'packages/*/src/**/*.{test,spec}.ts',
      'apps/*/src/**/*.{test,spec}.ts',
    ],
  },
});

