#!/usr/bin/env node
// Q5 isolation test — chat pipeline must NEVER touch project_secrets.
//
// Per DASHBOARD_RECON_REPORT Q5 + DASHBOARD_BUILD_REPORT screen 09:
// the chat / LLM pipeline has NO access route to encrypted secret values.
// The vault is reachable only through routes/secrets.ts behind the
// X-Reauth-Token gate.
//
// This is a static check: any chat-pipeline source file referencing
// project_secrets, secrets-injector, or routes/secrets means a leak
// vector. Run as part of CI before deploys.
//
// Usage:  node tests/security/chat-secret-isolation.mjs
// Exit:   0 = pass, 1 = leak detected.
//
// If you ARE wiring secrets into deploy (the deferred follow-up), the new
// module lives separately (e.g. services/secrets-injector.ts) and is
// imported ONLY by the deploy path. The whitelist below stays as-is.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

// Exhaustive chat-pipeline source list. Any of these touching the vault
// is a violation.
const CHAT_PIPELINE_FILES = [
  'apps/api/src/routes/chat.ts',
  'apps/api/src/routes/chat-sessions.ts',
  'apps/api/src/services/model-router.ts',
  'apps/api/src/services/litellm-client.ts',
];

// Patterns that indicate the file is reaching into the secret vault.
const FORBIDDEN_PATTERNS = [
  { name: 'project_secrets table reference', re: /\bproject_secrets\b/ },
  { name: 'secrets-injector import',         re: /\bsecrets-injector\b/ },
  { name: 'routes/secrets import',           re: /from\s+['"][^'"]*routes\/secrets['"]/ },
];

let failures = 0;
let checked = 0;

for (const rel of CHAT_PIPELINE_FILES) {
  const abs = resolve(REPO_ROOT, rel);
  if (!existsSync(abs)) {
    console.error(`✗ MISSING ${rel} — chat pipeline file not found; update test whitelist`);
    failures += 1;
    continue;
  }
  const source = readFileSync(abs, 'utf8');
  let fileFail = false;
  for (const { name, re } of FORBIDDEN_PATTERNS) {
    if (re.test(source)) {
      console.error(`✗ LEAK   ${rel} — matches forbidden pattern: ${name}`);
      fileFail = true;
      failures += 1;
    }
  }
  if (!fileFail) {
    console.log(`✓ OK     ${rel}`);
  }
  checked += 1;
}

if (failures > 0) {
  console.error(`\n✗ Q5 isolation FAILED — ${failures} leak(s) across ${checked} chat-pipeline file(s).`);
  console.error('  See DASHBOARD_BUILD_REPORT.md → screen 09 for the rule.');
  process.exit(1);
}

console.log(`\n✓ Q5 isolation PASSED — ${checked} chat-pipeline files clean.`);
process.exit(0);
