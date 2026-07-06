import { fileURLToPath } from 'node:url';

// P1.7: minimal vitest setup for web unit tests. Resolves the `@/` path alias
// (mirrors tsconfig paths) so modules under test can be imported/mocked. Kept
// dependency-free (no `vitest/config` import) so it loads even when vitest is run
// from a sibling package's binary in this pnpm monorepo.
export default {
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
};
