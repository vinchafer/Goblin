import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  clean: true,
  splitting: false,
  sourcemap: false,
  target: 'node20',
  // @goblin/shared exports its TypeScript SOURCE (extensionless ESM re-exports like
  // `export * from './schemas'`), which Node's ESM loader can't resolve at runtime.
  // Since FEEL-3a is the first server code to import it (U2 classify + STC integrity),
  // bundle it INTO dist instead of externalizing it, so the deployed API is
  // self-contained and boots. (diff/zod/etc. inline cleanly via esbuild.)
  noExternal: ['@goblin/shared'],
});
