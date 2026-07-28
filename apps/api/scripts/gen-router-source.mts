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

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

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

// ── The scan fixtures, for the same reason ──────────────────────────────────
//
// U2.8's E2E runner re-runs the 9/9 battery ON PRODUCTION, from the deployed API.
// The bundle cannot read __fixtures__/ off disk any more than it can read
// worker.js, so the fixtures are emitted as a constant too. The unit battery keeps
// reading the real FILES (a reviewer must be able to open benign-06 and judge
// whether it is really an honest security guide), and a test asserts the two match
// — so prod runs the same nine artifacts the repo reviews.

const fixtureRoot = join(here, '..', 'src', 'services', 'safety', '__fixtures__', 'hosted-publish');
const fixtureOut = join(here, '..', 'src', 'services', 'safety', 'hosted-fixtures.generated.ts');

const fixtures: Record<string, Record<string, string>> = {};
for (const dir of readdirSync(fixtureRoot).sort()) {
  const full = join(fixtureRoot, dir);
  if (!statSync(full).isDirectory()) continue;
  const files: Record<string, string> = {};
  const walk = (d: string) => {
    for (const entry of readdirSync(d).sort()) {
      const p = join(d, entry);
      if (statSync(p).isDirectory()) walk(p);
      else files[relative(full, p).split('\\').join('/')] = readFileSync(p, 'utf8');
    }
  };
  walk(full);
  fixtures[dir] = files;
}

const fixtureBody = `/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source of truth: \`src/services/safety/__fixtures__/hosted-publish/\`.
 * Regenerate with: \`pnpm --filter @goblin/api ops:gen-router\`.
 *
 * The unit battery reads the real files; this constant exists so the DEPLOYED API
 * can re-run the same nine artifacts on production (U2.8). A test asserts the two
 * are identical.
 */

/* eslint-disable */

export const HOSTED_SCAN_FIXTURES: Record<string, Record<string, string>> =
${JSON.stringify(fixtures, null, 2)};
`;

writeFileSync(fixtureOut, fixtureBody, 'utf8');
console.log(`wrote ${fixtureOut} (${Object.keys(fixtures).length} fixtures)`);
