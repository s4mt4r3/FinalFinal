import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const alias = { '@': fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '') };
// tsconfig has jsx: "preserve" for Next; tests need esbuild to actually transform JSX.
const esbuild = { jsx: 'automatic' as const };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        esbuild,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
          setupFiles: ['tests/setup/unit.setup.ts'],
          restoreMocks: true,
          unstubEnvs: true,
        },
      },
      {
        resolve: { alias },
        esbuild,
        test: {
          name: 'db',
          environment: 'node',
          include: ['tests/db/**/*.test.ts'],
          setupFiles: ['tests/setup/db.setup.ts'],
          // Tests share one local Postgres; run files serially so user fixtures don't interleave.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['lib/**/*.ts', 'app/api/**/*.ts', 'middleware.ts', 'next.config.ts', 'app/layout.tsx', 'app/login/page.tsx'],
      // Browser-only Supabase factory and the service-role client have no logic to test.
      exclude: ['lib/supabase-client.ts', 'lib/supabase-admin.ts'],
      // Floors pinned at the measured baseline (2026-10-14), rounded down. Raise
      // them as coverage improves; never lower them to make a change pass.
      thresholds: {
        statements: 98,
        branches: 90,
        functions: 100,
        lines: 99,
        'lib/**': { lines: 99, statements: 98, functions: 100, branches: 88 },
        'lib/api-helpers.ts': { lines: 95, statements: 95, functions: 100, branches: 95 },
        'app/api/**': { lines: 99, statements: 98, functions: 100, branches: 95 },
      },
    },
  },
});
