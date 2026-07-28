/**
 * AKT 2 · PHASE 2 · U2.1 — generate the router Worker's source constant.
 *
 * `src/services/ops-router/worker.js` is the source of truth: real JavaScript, so
 * an editor, a linter and a test can all see it. But the API is bundled (tsup) and
 * a bundle cannot read a loose .js file off disk at runtime, so the deploy path
 * ships a string constant instead.
 *
 * This script writes that constant. The pair is kept honest by a test that
 * re-reads worker.js and compares byte-for-byte, so a change to the Worker that
 * was never regenerated fails CI instead of silently deploying stale code.
 *
 *   pnpm --filter @goblin/api ops:gen-router
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const workerPath = join(here, '..', 'src', 'services', 'ops-router', 'worker.js');
const outPath = join(here, '..', 'src', 'services', 'ops-router', 'worker-source.generated.ts');

const source = readFileSync(workerPath, 'utf8');

// One JSON-quoted string per source line, joined at runtime. A single giant
// literal would work too, but this shape makes the PR diff of a Worker change
// readable line by line instead of one 12 KB blob.
const lines = source.split('\n').map((l) => `  ${JSON.stringify(l)},`).join('\n');

const out = `/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source of truth: \`src/services/ops-router/worker.js\`.
 * Regenerate with: \`pnpm --filter @goblin/api ops:gen-router\`.
 *
 * \`worker.test.ts\` re-reads worker.js and asserts this constant matches it
 * byte-for-byte, so an edit that was never regenerated fails the suite rather
 * than deploying stale code.
 */

/* eslint-disable */

export const ROUTER_WORKER_SOURCE = [
${lines}
].join('\\n');

/** The single platform-owned Worker script name on the lean plane. */
export const ROUTER_SCRIPT_NAME = 'goblin-apps-router';
`;

writeFileSync(outPath, out, 'utf8');
console.log(`wrote ${outPath} (${source.length} bytes of worker source, ${source.split('\n').length} lines)`);
