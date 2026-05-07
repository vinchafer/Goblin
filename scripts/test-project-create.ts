#!/usr/bin/env tsx
/**
 * Targeted smoke test: Project CRUD + CORS preflight
 * Usage: npx tsx scripts/test-project-create.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_API_URL
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const WEB_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'https://goblin-web.vercel.app';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

function ok(label: string, detail?: string) {
  passed++;
  console.log(`${GREEN}  ✓${RESET} ${label}${detail ? `  (${detail})` : ''}`);
}

function fail(label: string, detail: string) {
  failed++;
  console.error(`${RED}  ✗ ${label}${RESET}`);
  console.error(`    ${detail}`);
}

function section(title: string) {
  console.log(`\n${YELLOW}▸ ${title}${RESET}`);
}

// ── Validate config ────────────────────────────────────────────────────────────

const missing = (['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_API_URL'] as const)
  .filter(k => !process.env[k]);
if (missing.length) {
  console.error(`${RED}Missing env vars: ${missing.join(', ')}${RESET}`);
  process.exit(1);
}

console.log(`\nGoblin Project CRUD Test`);
console.log(`API: ${API_URL}`);
console.log(`Origin under test: ${WEB_ORIGIN}`);

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
  const email = `smoke-${randomBytes(6).toString('hex')}@test.local`;
  let token = '';
  let userId = '';
  let projectId = '';

  // ── 1. Auth ──────────────────────────────────────────────────────────────────
  section('Auth');
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email, password: 'Smoke1234!', email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    ok('User created', email);
  } catch (e) {
    fail('Create user', String(e));
    process.exit(1);
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email, password: 'Smoke1234!',
    });
    if (error || !data.session) throw error ?? new Error('No session');
    token = data.session.access_token;
    ok('Sign-in, token obtained');
  } catch (e) {
    fail('Sign-in', String(e));
    await supabase.auth.admin.deleteUser(userId);
    process.exit(1);
  }

  // ── 2. CORS preflight ────────────────────────────────────────────────────────
  section('CORS preflight (simulates browser)');
  try {
    const res = await fetch(`${API_URL}/api/projects`, {
      method: 'OPTIONS',
      headers: {
        Origin: WEB_ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      },
    });
    const acao = res.headers.get('Access-Control-Allow-Origin');
    const acam = res.headers.get('Access-Control-Allow-Methods');
    if (!acao) {
      fail('CORS: Access-Control-Allow-Origin missing', `Status ${res.status} — API likely blocking ${WEB_ORIGIN}`);
    } else {
      ok('CORS origin allowed', acao);
    }
    if (acam && acam.includes('POST')) {
      ok('CORS methods include POST', acam);
    } else {
      fail('CORS methods', `Access-Control-Allow-Methods = ${acam ?? 'missing'}`);
    }
    if (acam && acam.includes('PATCH')) {
      ok('CORS methods include PATCH', acam);
    } else {
      fail('CORS missing PATCH', `Access-Control-Allow-Methods = ${acam ?? 'missing'} — pending-injections/acknowledge will fail`);
    }
  } catch (e) {
    fail('CORS preflight request', String(e));
  }

  // ── 3. POST /api/projects ────────────────────────────────────────────────────
  section('POST /api/projects');
  try {
    const res = await fetch(`${API_URL}/api/projects`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Origin: WEB_ORIGIN,
      },
      body: JSON.stringify({ name: 'Smoke Test Project', description: 'CRUD test' }),
    });
    const body = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      fail(`POST /api/projects → ${res.status}`, JSON.stringify(body));
    } else {
      projectId = body.id as string;
      ok(`Project created`, `id=${projectId}`);
    }
  } catch (e) {
    fail('POST /api/projects (network)', String(e));
    console.error(`  → "Failed to fetch" means CORS is blocking or server unreachable`);
  }

  // ── 4. GET /api/projects ─────────────────────────────────────────────────────
  section('GET /api/projects');
  try {
    const res = await fetch(`${API_URL}/api/projects`, {
      headers: { Authorization: `Bearer ${token}`, Origin: WEB_ORIGIN },
    });
    const body = await res.json() as unknown[];
    if (!res.ok) {
      fail(`GET /api/projects → ${res.status}`, JSON.stringify(body));
    } else {
      const found = body.some((p: unknown) => (p as Record<string, unknown>).id === projectId);
      ok(`Listed projects`, `${body.length} total, created project ${found ? 'found' : 'NOT FOUND'}`);
      if (!found && projectId) fail('Project missing from list', `id=${projectId} not returned`);
    }
  } catch (e) {
    fail('GET /api/projects (network)', String(e));
  }

  // ── 5. GET /api/projects/:id ─────────────────────────────────────────────────
  if (projectId) {
    section('GET /api/projects/:id');
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}`, Origin: WEB_ORIGIN },
      });
      const body = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        fail(`GET /api/projects/${projectId} → ${res.status}`, JSON.stringify(body));
      } else {
        ok(`Fetched single project`, `name="${body.name}"`);
      }
    } catch (e) {
      fail('GET /api/projects/:id (network)', String(e));
    }
  }

  // ── 6. DELETE /api/projects/:id ──────────────────────────────────────────────
  if (projectId) {
    section('DELETE /api/projects/:id');
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, Origin: WEB_ORIGIN },
      });
      const body = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        fail(`DELETE /api/projects/${projectId} → ${res.status}`, JSON.stringify(body));
      } else {
        ok(`Project deleted`, `success=${body.success}`);
      }
    } catch (e) {
      fail('DELETE /api/projects/:id (network)', String(e));
    }
  }

  // ── 7. Cleanup test user ─────────────────────────────────────────────────────
  section('Cleanup');
  try {
    await supabase.auth.admin.deleteUser(userId);
    ok('Test user deleted');
  } catch (e) {
    console.warn(`${YELLOW}  ! Cleanup failed — delete ${email} manually${RESET}`);
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(40)}`);
  if (failed === 0) {
    console.log(`${GREEN}All ${passed} checks passed${RESET}`);
  } else {
    console.log(`${RED}${failed} failed${RESET}, ${GREEN}${passed} passed${RESET}`);
    process.exit(1);
  }
}

run().catch(e => {
  console.error(`\n${RED}Fatal: ${e}${RESET}`);
  process.exit(1);
});
