// WAVE-B B3 — the proof path, verified deterministically in-session (the LIVE run is founder-
// gated). Ties the pieces together: provision → RLS-always schema applied → the generated
// client wires anonKey + auth + RLS. Plus static assertions on the committed proof artifacts
// (reference app + adversarial RLS probe) so the founder's live gate runs known-good code.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { runProvisionBackend, newProvisionState, type ProvisionDeps } from './provision-tool';
import type { BackendProvider, ProvisionedBackend } from './types';
import type { ToolContext } from '../agent/types';

const proofAppSrc = readFileSync(new URL('../../../../../evidence/wave-b/proof-app/index.html', import.meta.url), 'utf8');
const rlsProbeSrc = readFileSync(new URL('../../../../../evidence/wave-b/rls-probe.mjs', import.meta.url), 'utf8');

const ctx: ToolContext = { userId: 'uA', projectId: 'pProof', sessionId: 's1' };
const proofTables = [
  { name: 'tasks', columns: [
    { name: 'title', type: 'text' as const, notNull: true },
    { name: 'done', type: 'boolean' as const, default: 'false' as const },
  ] },
];

function backend(): ProvisionedBackend {
  return {
    provider: 'supabase', projectRef: 'proofref', projectUrl: 'https://proofref.supabase.co',
    region: 'eu-central-1', anonKey: 'ANON_PUBLIC', serviceRoleKey: 'SERVICE_ROLE_SECRET', provisionLatencyMs: 3100,
  };
}

describe('B3 — the proof path (deterministic, mocked)', () => {
  it('provisions the todo backend and applies RLS-always schema for `tasks`', async () => {
    const applySchema = vi.fn().mockResolvedValue({ ok: true, tablesCreated: 1, rlsEnabled: true });
    const provider: BackendProvider = {
      id: 'supabase',
      isConnected: vi.fn().mockResolvedValue(true),
      provision: vi.fn().mockResolvedValue(backend()),
      applySchema,
      teardown: vi.fn(),
    };
    const deps: ProvisionDeps = {
      provider,
      resolvePlan: vi.fn().mockResolvedValue('trial'),
      tableAvailable: vi.fn().mockResolvedValue(true),
      countUserBackends: vi.fn().mockResolvedValue(0),
      getProjectBackend: vi.fn().mockResolvedValue(null),
      recordProvisioned: vi.fn().mockResolvedValue('row1'),
      recordFailed: vi.fn(),
    };

    const res = await runProvisionBackend(deps, ctx, newProvisionState(), { name: 'aufgaben', tables: proofTables });
    expect(res.ok).toBe(true);
    expect(res.summary).toMatch(/Datenbank angelegt: 1 Tabellen, RLS aktiv/);

    // The exact SQL that reached the provider must isolate `tasks` per user.
    const sql = applySchema.mock.calls[0]![2] as string;
    expect(sql).toContain('alter table public."tasks" enable row level security;');
    expect(sql).toContain('"tasks_select_own"');
    expect(sql).toContain('"tasks_insert_own"');
    expect(sql).toContain('auth.uid() = user_id');

    // What the agent gets back to wire the client: public URL + anon key, never the secret.
    const data = res.data as Record<string, unknown>;
    expect(data.projectUrl).toBe('https://proofref.supabase.co');
    expect(data.anonKey).toBe('ANON_PUBLIC');
    expect(JSON.stringify(res)).not.toContain('SERVICE_ROLE_SECRET');
  });
});

describe('B3 — reference generated app wires anonKey + auth + RLS (no secret)', () => {
  it('uses the supabase-js client with the PUBLIC url + anon key', () => {
    expect(proofAppSrc).toContain("import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'");
    expect(proofAppSrc).toContain('createClient(SUPABASE_URL, SUPABASE_ANON_KEY)');
    expect(proofAppSrc).toContain('__SUPABASE_URL__');
    expect(proofAppSrc).toContain('__SUPABASE_ANON_KEY__');
  });
  it('logs in and relies on RLS (no manual per-user filter; insert sets user_id)', () => {
    expect(proofAppSrc).toContain('signInWithPassword');
    expect(proofAppSrc).toContain('signUp');
    // select trusts RLS — never a client-side "where user_id = me" filter on read.
    expect(proofAppSrc).toContain(".from('tasks').select('*')");
    expect(proofAppSrc).not.toMatch(/select\([^)]*\).*eq\('user_id'/);
    expect(proofAppSrc).toContain('user_id: user.id'); // insert sets the owner (RLS check)
  });
  it('never contains a service_role / secret key', () => {
    expect(proofAppSrc.toLowerCase()).not.toContain('service_role');
    expect(proofAppSrc).not.toContain('SUPABASE_SERVICE');
  });
});

describe('B3 — adversarial RLS probe is secretless and attempts real cross-user access', () => {
  it('has the skip (exit 2) path and commits no keys', () => {
    expect(rlsProbeSrc).toContain('process.exit(2)'); // SKIP, never a false pass
    expect(rlsProbeSrc).toContain('process.env');
    // No hardcoded JWT/anon material.
    expect(rlsProbeSrc).not.toMatch(/eyJ[A-Za-z0-9_-]{8,}\./);
  });
  it('attempts read + write + forged-insert as the attacker and asserts denial', () => {
    for (const attempt of ['read-all', 'read-by-id', 'update', 'delete', 'forge-insert']) {
      expect(rlsProbeSrc).toContain(attempt);
    }
    expect(rlsProbeSrc).toContain('writeDenied');
    expect(rlsProbeSrc).toContain('readDenied');
    expect(rlsProbeSrc).toContain('process.exit(1)'); // FAIL on any leak
  });
});
